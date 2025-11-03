Update: Replace Odds System with Weighted-Count Probability Model & New Payout Logic
Background

The previous pool logic used odds (e.g., 2.0, 1.5) to determine outcomes and display potential payouts.
We’re replacing that with a weighted probability model that reflects prediction sentiment more fairly and updates dynamically with each stake.

🧮 1. Weighted-Count Probability Model
Purpose

Instead of letting the amount of money entirely determine the odds, we’ll compute the probability of “Yes” or “No” using a weighted-count system that balances between the number of predictors and the size of their stake.

Formula
weight = sqrt(stake)


(or use log(stake + 1) — both are acceptable for MVP, choose based on ease).

Then:

P_yes = (Σ weights of all “Yes” predictions) / (Σ weights of all predictions)
P_no = 1 - P_yes


This gives us a probability between 0 and 1 for each side.

Example
Predictor	Choice	Stake	Weight (√stake)
A	Yes	100	10
B	Yes	25	5
C	No	49	7

Total weights = 10 + 5 + 7 = 22
P_yes = 15 / 22 = 0.682
P_no = 0.318

→ Displayed on UI as Yes (68.2%) / No (31.8%)

Expected Outcome

Bigger stakers influence more but not disproportionately.

Probability updates live as new predictions arrive.

These values replace traditional “odds” entirely in both DB and API responses.

💰 2. Potential Payout Calculation (Dynamic & Fair)
Purpose

Predictors see a real-time estimate of what their payout would be if the market ended now — based on actual pool proportions.

Formula
potentialPayout = (userStake / totalStakeOnUserSide) * totalPool

Example

Yes pool = 600

No pool = 400

Total pool = 1000

User stakes 100 on “Yes”

potentialPayout = (100 / 600) * 1000 = 166.67

This value updates dynamically as the pool composition changes.

Rules

Cap potential payout display so it never exceeds totalPool * 0.8 (UX fairness).

Actual settlement will still use exact pool ratios at pool closure.

Display this only during open pools.

⚙️ Implementation Notes

Database changes

Remove or ignore previous odds fields.

Store:

probabilityYes

probabilityNo

totalYesStake

totalNoStake

Keep user-level stake and choice for recalculation.

Real-time updates

Recompute probabilities and pool totals every time a new prediction is placed.

Return updated values in the API response:

{
  "probabilityYes": 0.68,
  "probabilityNo": 0.32,
  "potentialPayout": 166.67
}