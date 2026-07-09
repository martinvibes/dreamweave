// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DreamVault
 * @notice A shared-budget settlement layer that sits ON TOP of CAP — it does
 *         NOT replace CAP's per-order escrow.
 *
 *  Why this exists
 *  ---------------
 *  CAP escrows a single order: one buyer, one seller, one payment. A "dream",
 *  however, is one sponsor funding MANY sub-orders across MANY agents from a
 *  single budget. Three things are awkward or impossible with per-order escrow
 *  alone, and DreamVault provides them as a first-class on-chain primitive:
 *
 *    1. Shared budget          — lock ONE budget, draw many sub-payments from it.
 *    2. Atomic multi-settle    — release a batch of verified sub-orders together
 *                                (all-or-nothing), so a partially-built dream
 *                                never strands funds.
 *    3. Automatic refund       — whatever the crew doesn't earn returns to the
 *                                sponsor when the dream closes, with an on-chain
 *                                "weave receipt" binding every sub-order id.
 *
 *  Trust model
 *  -----------
 *  DreamVault only moves money to a seller once the Weaver has attested that the
 *  seller's CAP order reached `Clear` (proof verified). It re-expresses CAP's
 *  rule — "no proof, no payment" — at the budget level: a payout carries the
 *  proof hash that CAP verified, recorded on-chain for auditability. The Weaver
 *  is the vault's designated orchestrator; the sponsor can always reclaim the
 *  remainder after the deadline, so funds are never locked forever.
 *
 *  This contract is written to deploy on Base (mainnet 8453 / Sepolia 84532)
 *  against the canonical USDC (6 decimals). It is intentionally small, audited
 *  by reading, and has no owner/upgrade backdoor.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract DreamVault {
    // --- types ---------------------------------------------------------------

    enum DreamStatus {
        None,
        Open, // budget locked, weaving in progress
        Closed // settled + remainder refunded (terminal)
    }

    struct Dream {
        address sponsor; // who funded the budget
        address weaver; // orchestrator authorised to release payouts
        uint256 budget; // total USDC locked (base units)
        uint256 spent; // USDC released to sellers so far
        uint64 deadline; // after this, sponsor may reclaim remainder
        DreamStatus status;
    }

    struct Payout {
        address seller;
        uint256 amount;
        bytes32 capOrderId; // the CAP order this settles
        bytes32 proofHash; // the delivery proof CAP verified
    }

    // --- storage -------------------------------------------------------------

    IERC20 public immutable usdc;
    uint256 public nextDreamId = 1;
    mapping(uint256 => Dream) public dreams;
    // dreamId => cap order id => already paid (prevents double-settle)
    mapping(uint256 => mapping(bytes32 => bool)) public settled;

    // --- events (indexers / the DreamWeave UI read these) --------------------

    event DreamOpened(
        uint256 indexed dreamId,
        address indexed sponsor,
        address indexed weaver,
        uint256 budget,
        uint64 deadline
    );
    event ThreadSettled(
        uint256 indexed dreamId,
        address indexed seller,
        uint256 amount,
        bytes32 capOrderId,
        bytes32 proofHash
    );
    event DreamClosed(uint256 indexed dreamId, uint256 spent, uint256 refunded);

    // --- errors --------------------------------------------------------------

    error NotWeaver();
    error NotSponsor();
    error BadStatus();
    error BudgetExceeded();
    error AlreadySettled();
    error DeadlineNotReached();
    error ZeroAddress();

    // --- constructor ---------------------------------------------------------

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    // --- lifecycle -----------------------------------------------------------

    /**
     * @notice Open a dream: pull `budget` USDC from the sponsor and lock it.
     * @param weaver   the agent authorised to release proof-gated payouts.
     * @param budget   total USDC (base units) to escrow for the whole dream.
     * @param deadline unix seconds after which the sponsor may reclaim remainder.
     *
     * The sponsor must `usdc.approve(dreamVault, budget)` first.
     */
    function openDream(address weaver, uint256 budget, uint64 deadline)
        external
        returns (uint256 dreamId)
    {
        if (weaver == address(0)) revert ZeroAddress();
        dreamId = nextDreamId++;
        dreams[dreamId] = Dream({
            sponsor: msg.sender,
            weaver: weaver,
            budget: budget,
            spent: 0,
            deadline: deadline,
            status: DreamStatus.Open
        });
        // Effects above; interaction below (checks-effects-interactions).
        bool ok = usdc.transferFrom(msg.sender, address(this), budget);
        require(ok, "usdc transferFrom failed");
        emit DreamOpened(dreamId, msg.sender, weaver, budget, deadline);
    }

    /**
     * @notice Release one verified sub-order's payment to its seller.
     * @dev Only the dream's Weaver may call, and only for a CAP order it has
     *      seen reach Clear. `proofHash` is the artifact commitment CAP verified.
     */
    function settleThread(uint256 dreamId, Payout calldata p) public {
        Dream storage d = dreams[dreamId];
        if (d.status != DreamStatus.Open) revert BadStatus();
        if (msg.sender != d.weaver) revert NotWeaver();
        if (settled[dreamId][p.capOrderId]) revert AlreadySettled();
        if (d.spent + p.amount > d.budget) revert BudgetExceeded();
        if (p.seller == address(0)) revert ZeroAddress();

        settled[dreamId][p.capOrderId] = true;
        d.spent += p.amount;

        bool ok = usdc.transfer(p.seller, p.amount);
        require(ok, "usdc transfer failed");
        emit ThreadSettled(dreamId, p.seller, p.amount, p.capOrderId, p.proofHash);
    }

    /**
     * @notice Atomically release a batch of verified sub-orders (all-or-nothing).
     *         If any single payout is invalid the whole transaction reverts, so
     *         a dream never settles a partial, inconsistent set.
     */
    function settleBatch(uint256 dreamId, Payout[] calldata payouts) external {
        for (uint256 i = 0; i < payouts.length; i++) {
            settleThread(dreamId, payouts[i]);
        }
    }

    /**
     * @notice Close the dream and refund the unspent remainder to the sponsor.
     *         Callable by the Weaver at any time (work finished) or by the
     *         sponsor after the deadline (safety hatch against a stalled Weaver).
     */
    function closeDream(uint256 dreamId) external {
        Dream storage d = dreams[dreamId];
        if (d.status != DreamStatus.Open) revert BadStatus();

        bool byWeaver = msg.sender == d.weaver;
        bool bySponsorAfterDeadline =
            msg.sender == d.sponsor && block.timestamp >= d.deadline;
        if (!byWeaver && !bySponsorAfterDeadline) {
            if (msg.sender == d.sponsor) revert DeadlineNotReached();
            revert NotWeaver();
        }

        uint256 refund = d.budget - d.spent;
        d.status = DreamStatus.Closed;
        if (refund > 0) {
            bool ok = usdc.transfer(d.sponsor, refund);
            require(ok, "usdc refund failed");
        }
        emit DreamClosed(dreamId, d.spent, refund);
    }

    // --- views ---------------------------------------------------------------

    function remaining(uint256 dreamId) external view returns (uint256) {
        Dream storage d = dreams[dreamId];
        return d.budget - d.spent;
    }
}
