---
title: "Maximum Purchase Price Formula for House Flips (2026): Your Real Max Offer | FlipRadar"
meta_description: "Calculate the most you can pay for a flip and still hit your profit: ARV minus repairs, buying, holding, selling and financing costs, and a profit you choose."
h1: "Maximum Purchase Price: How to Calculate Your Real Max Offer on a Flip"
slug: /guides/maximum-purchase-price
page_type: guide
status: draft-for-tony-review
word_count: 1529
related_live_url: new page
sources:
  - none (no outside statistics used; all costs are labeled hypothetical)
---

The 70% rule guesses at your costs. The Maximum Purchase Price (MPP) calculation uses them. It answers one question: given what this house will sell for, what it will cost to fix, hold, finance and sell, and the profit you require, what is the most you can pay?

It takes ten minutes longer than the 70% rule. It is the number you should be willing to defend to a seller, a lender and yourself.

## Key takeaways

- **MPP = ARV − repairs − buying costs − holding costs − financing costs − selling costs − desired profit.**
- **Profit is an input, not a leftover.** Decide it before you look at the asking price.
- **Some costs depend on the price you pay** (buying costs, points, interest). Solve for them with the short formula below, or iterate twice in a spreadsheet.
- **MPP can be higher or lower than the 70% rule.** On mid-priced houses with normal costs it is often a little higher. On cheap houses, heavy rehabs or long holds, it is usually lower.
- **If the seller will not accept your MPP,** change the terms or the plan, or walk. Do not change the profit.

## How to apply this

1. **ARV:** conservative, from adjusted, sold comps. See the [ARV calculator](/tools/arv-calculator).
2. **Repairs:** full rehab budget with contingency. See the [rehab cost estimator](/tools/rehab-cost-estimator).
3. **Buying costs:** title, escrow, recording, inspections, lender's title policy. Usually a percentage of price.
4. **Holding costs:** taxes, insurance, utilities, HOA, lawn and security for the full hold, closing to closing. See [holding costs on a 6-month flip](/guides/holding-costs-on-a-6-month-flip).
5. **Financing costs:** points, lender fees, and interest. See the [hard money loan calculator](/tools/hard-money-loan-calculator).
6. **Selling costs:** commissions, concessions, transfer taxes, title, escrow and the buyer's repair requests. Use your local numbers.
7. **Desired profit:** a dollar amount and a share of ARV you will not go below.
8. **Solve for the price** using the formula below.
9. **Test it:** re-run with a longer hold and a 5% lower ARV. If profit disappears, lower the MPP or pass.

## Inputs explained

| Input | Depends on purchase price? | Notes |
|---|---|---|
| ARV | No | The most important and most error-prone input |
| Repairs | No | Include contingency |
| Buying costs | Yes, mostly | Some fees are fixed |
| Holding (operating) costs | Mostly no | Taxes may be reassessed after purchase in some places |
| Financing costs | Yes | Points and interest scale with the loan, which scales with price |
| Selling costs | No (scales with sale price) | Commissions and concessions are negotiable; use realistic numbers |
| Desired profit | No | Set it by risk, not by how much you like the house |

### Setting your desired profit

Use two floors and take the higher one:

- **A percentage of ARV,** so the cushion grows with the price of the house.
- **A dollar minimum,** so a cheap house still pays enough to justify the months of work and the risk.

Raise both for heavy rehabs, older houses, unfamiliar areas, first deals, and hot markets where values may be stretched. FlipRadar does not publish a "standard" profit target because the right one depends on your risk and experience.

## Formula

The simple version, if you treat buying and financing costs as fixed amounts:

```
MPP = ARV − Repairs − Buying − Holding − Financing − Selling − Desired profit
```

The more accurate version, when buying and financing costs scale with the price you pay:

```
Let:
  b = buying costs as a share of purchase price
  f = financing costs that scale with purchase price, as a share of purchase price
  F = financing costs that do not scale with price (fixed fees, points and interest on rehab money)

MPP = (ARV − Repairs − Holding − Selling − F − Desired profit) ÷ (1 + b + f)
```

If that looks like too much algebra, put the simple version in a spreadsheet, guess a price, compute the costs at that price, recompute the MPP, and repeat once or twice. It converges quickly.

## Worked example (hypothetical)

FlipRadar's sample property. All numbers are hypothetical.

| Input | Value |
|---|---|
| ARV | $295,000 |
| Repairs (including 12% contingency) | $70,000 |
| Buying costs | 1.5% of purchase price |
| Holding (taxes, insurance, utilities: $700 × 6 months) | $4,200 |
| Selling costs (7% of ARV) | $20,650 |
| Financing | Hard money: 85% of purchase + 100% of rehab in four draws; 11% interest on drawn funds; 2 points; $2,750 in fees |
| Desired profit | $35,000 (about 12% of ARV) |

**Separate the financing costs:**

- Scale with price (f): points on the purchase portion (2% × 85% = 1.7% of price) plus six months of interest on the purchase portion (85% × 11% × 6/12 = 4.675% of price). f = 6.375%.
- Fixed (F): points on the rehab holdback ($1,400) + fees ($2,750) + interest on rehab draws (about $2,246) = about $6,396.

**Solve:**

```
MPP = ($295,000 − $70,000 − $4,200 − $20,650 − $6,396 − $35,000) ÷ (1 + 0.015 + 0.06375)
    = $158,754 ÷ 1.07875
    ≈ $147,165
```

**Check at $147,165:** buying costs about $2,207; financing about $15,778; holding $4,200; selling $20,650; repairs $70,000. Total costs plus purchase = $260,000. Profit = $295,000 − $260,000 = $35,000. The formula holds.

### MPP vs the 70% rule on the same deal

| Method | Max offer |
|---|---|
| 70% rule: $295,000 × 0.70 − $70,000 | $136,500 |
| Maximum Purchase Price with a $35,000 profit target | about $147,000 |
| Seller's asking price | $185,000 |

At this price point, with these costs, the MPP is about $10,700 higher than the 70% rule. The 70% rule is leaving room the deal does not strictly need, which matters when you are competing. On a $120,000 house, the same exercise usually lands **below** the 70% rule because fixed costs eat a bigger share. That is why the MPP is the better final number.

### Stress test

| Scenario | MPP for the same $35,000 profit |
|---|---|
| Base | about $147,000 |
| Hold runs 9 months, 1-point extension | about $8,000–$9,000 lower |
| ARV 5% lower ($280,250) | about $13,000 lower |
| Both | about $21,000 lower |

If you cannot buy near the stressed number, you are betting on the base case.

## What the result means

- **Asking price at or below your MPP:** the deal meets your profit target at your assumptions. Now verify them.
- **Asking price above your MPP:** you have three honest options.
  - **Change the terms:** a faster close, as-is with no repair requests, a seller credit for closing costs, or seller financing can be worth real money to both sides.
  - **Change the plan:** a smaller scope, if the ARV still holds with less work. Re-run the numbers.
  - **Walk away,** and leave a written offer. Sellers often come back after the house sits.
- **Never solve the gap by lowering your profit target** unless the deal is genuinely less risky than you assumed.

## Assumptions

- Costs and timing are realistic for your market and financing.
- The loan sizes and terms in the example are hypothetical.
- Selling costs scale with the sale price; some are fixed.
- No income taxes. Your after-tax profit will be lower.

## Limitations

- **Only as good as the inputs,** especially ARV and repairs.
- **Single scenario.** Run stress cases yourself.
- **Does not price your own labor or time** unless you include it in profit.
- **Not a lender's calculation.** A lender sizes the loan on its own valuation and caps.

## Common mistakes

1. **Treating profit as whatever is left over.**
2. **Forgetting that financing costs rise with the price you pay.**
3. **Using the asking price to set the costs.** Use your target price.
4. **Leaving out buying costs** because they "come out at closing."
5. **No stress test.**
6. **Lowering the profit target to win a deal.**
7. **Counting holding interest twice:** once in holding and again in financing.

## FAQ

### What is the Maximum Purchase Price formula?

MPP = ARV − repairs − buying costs − holding costs − financing costs − selling costs − desired profit. When buying and financing costs depend on the price, solve with the adjusted formula on this page or iterate in a spreadsheet.

### What does MPP mean in house flipping?

Maximum Purchase Price: the most you can pay for a property and still reach your profit target after all costs.

### Is MPP the same as MAO?

They answer the same question. MAO usually refers to the 70% rule shortcut; MPP usually means the full calculation using your actual costs.

### Is the MPP better than the 70% rule?

For a final offer, yes, because it uses your real costs and profit target. The 70% rule is faster for screening many leads.

### How much profit should I build into my MPP?

Set a percentage of ARV and a dollar minimum, and use the higher one. Increase both for riskier deals. FlipRadar does not publish a standard target.

### Why is my MPP higher than the 70% rule?

On mid-priced houses with normal costs, your real costs may be less than the 30% the rule reserves. On cheap houses or risky scopes, the MPP is usually lower than the 70% rule.

### What if my MPP is too low to win the deal?

Offer better terms, adjust the scope if the ARV holds, or walk away with a written offer on the table. Do not cut your profit to win.

### Should I include my own labor in the MPP?

If you do work yourself, either pay yourself a line item or recognize that part of your profit is wages. Otherwise you will overestimate what the deal earns.

### Does the MPP include taxes?

No. It is a before-tax profit target. See the [flip taxes guide](/guides/flip-taxes-short-term-gains-basics-not-tax-advice).

---

**Related:** [70% rule calculator](/tools/70-percent-rule-calculator) · [The 70% rule: when it works and when it breaks](/guides/the-70-rule-when-it-works-and-when-it-breaks) · [Flip profit calculator](/tools/flip-profit-calculator) · [Holding costs on a 6-month flip](/guides/holding-costs-on-a-6-month-flip)

*Educational information only. Not financial, legal or tax advice. Contact: save@sitesinc.co*
