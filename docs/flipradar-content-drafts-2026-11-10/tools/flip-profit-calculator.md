---
title: "Free Flip Profit Calculator (2026): Net Profit, ROI and Break-Even Price | FlipRadar"
meta_description: "Free house flip profit calculator, no signup. Model net profit after rehab, holding, financing and closing costs, then check ROI, annualized return and break-even."
h1: "Flip Profit Calculator: Net Profit, ROI and Break-Even Sale Price"
slug: /tools/flip-profit-calculator
page_type: tool
status: draft-for-tony-review
word_count: 2338
related_live_url: https://flipradar.co/tools/flip-profit-calculator
sources:
  - url: https://www.attomdata.com/news/market-trends/flipping/home-flipping-profits-continue-gradual-two-year-decline/
    used: "ATTOM Q2 2026 U.S. Home Flipping Report press release (Oct 1, 2026): typical 161 days from purchase to resale; definition of gross flipping profit and gross ROI (purchase-to-resale spread, excluding rehab and other costs)"
    accessed: 2026-11-10
  - url: https://www.attomdata.com/news/market-trends/flipping/2025-year-end-home-flipping-report/
    used: "ATTOM 2025 year-end U.S. Home Flipping Report press release (Mar 19, 2026): average 163 days from purchase to resale in 2025"
    accessed: 2026-11-10
---

A flip makes money in exactly one place: the gap between the sale price and **everything** you spent to get there. Purchase and rehab are the obvious costs. Interest, points, taxes, insurance, utilities and two sets of closing costs are the ones that quietly turn a good-looking spread into a thin or negative result.

This calculator models net profit, return on total cost and margin on ARV, and checks your purchase price against the 70% rule. This page adds what the calculator does not show directly: annualized return, break-even sale price, and how the numbers change when the flip runs long. Free, no account, nothing to buy.

## Key takeaways

- **Net profit = sale price − purchase − rehab − holding − financing − buying and selling costs.** Taxes come after that.
- **Gross profit is not your profit.** Headline "flip profit" figures usually mean resale minus purchase, before rehab and every other cost.
- **Return on total cost and margin on ARV** tell you whether the deal is worth the risk. **Cash-on-cash** tells you what your own money earned, and leverage inflates it.
- **Annualizing short flips can produce silly numbers.** Use it to compare deals, not to brag.
- **Break-even sale price** is the most useful risk number on this page: how far the sale price can fall before you lose money.
- **Time is the swing factor.** Every extra month adds interest and carrying costs and lowers annualized return.

## How to use the flip profit calculator

1. **Projected resale price (ARV):** your conservative ARV from adjusted, sold comps. See the [ARV calculator](/tools/arv-calculator).
2. **Purchase price:** the price you expect to pay, not the asking price.
3. **Rehab budget:** the full budget including contingency, from the [rehab cost estimator](/tools/rehab-cost-estimator).
4. **Holding period (months):** closing to closing. Include rehab time, permit delays, listing time and the buyer's closing period.
5. **Monthly holding costs:** property taxes, insurance, utilities, HOA dues and loan interest. If your lender draws rehab funds over time, use your average monthly interest, or use the [hard money loan calculator](/tools/hard-money-loan-calculator) to get the total and divide by months.
6. **Total buying and selling costs (%):** the calculator applies this percentage to the resale price. Add buying closing costs, selling costs (commissions, concessions, transfer taxes, title, escrow) and any lender points and fees not already in your monthly holding cost, then divide by ARV.
7. **Read the outputs:** net profit, net ROI (on total cost), margin on ARV, total all-in cost, and a 70% rule benchmark offer to compare against your purchase price.
8. **Run it three ways:** base case, a long hold (add three months), and a lower sale price (ARV down 5%). If the deal only works in the base case, it does not have enough margin.

## Inputs explained

| Input | What to include | What to leave out |
|---|---|---|
| Projected resale price (ARV) | Expected sale price after rehab | Appreciation you hope for during the hold |
| Purchase price | Contract price | Closing costs (they go in the % input) |
| Rehab budget | All construction, permits, contingency, dumpsters, cleaning, staging | Loan interest |
| Holding period | Months from purchase closing to sale closing | |
| Monthly holding costs | Taxes, insurance (vacant or builder's risk), utilities, HOA, lawn and security, loan interest | One-time fees (put them in the % input) |
| Buying + selling costs (%) | Buyer-side title, escrow and recording; seller-side commissions, concessions, transfer taxes, title and escrow; lender points and fees | Income taxes on the profit |

## Formula

```
Holding cost        = Monthly holding costs × Months
Closing costs       = Resale price × Buying + selling cost %
Total all-in cost   = Purchase + Rehab + Holding cost + Closing costs
Net profit          = Resale price − Total all-in cost
Net ROI (on cost)   = Net profit ÷ Total all-in cost
Margin on ARV       = Net profit ÷ Resale price
70% benchmark offer = Resale price × 0.70 − Rehab
```

### Formulas the calculator does not show (do these by hand)

```
Cash-on-cash return       = Net profit ÷ Your own cash invested
Annualized return (simple) = Return × (12 ÷ Months held)
Annualized return (compound) = (1 + Return)^(12 ÷ Months held) − 1
Break-even sale price     = (Total all-in cost − Selling costs) ÷ (1 − Selling cost %)
Gross profit (headline)   = Resale price − Purchase price
```

"Your own cash invested" is everything that came out of your pocket: down payment, closing costs, points and fees, any rehab not funded by the lender, monthly interest and carrying costs you paid during the hold.

## Worked example (hypothetical)

FlipRadar's sample property, bought below the 70% MAO after negotiation. All numbers are hypothetical.

**Deal:**
- ARV: $295,000
- Purchase: $145,000
- Rehab: $70,000
- Hold: 6 months (4 months of work, 2 months to list and close)

**Costs (hypothetical):**
- Buying closing costs: 1.5% of purchase = $2,175
- Hard money loan: 85% of purchase ($123,250) plus 100% of rehab ($70,000) paid in four $17,500 draws = $193,250 total. 11% interest, 2 points ($3,865), $2,750 in underwriting, document and draw fees
- Interest, charged only on money drawn: $6,779 on the purchase portion + $2,246 on rehab draws = $9,025
- Taxes, insurance, utilities: $700 a month × 6 = $4,200
- Selling costs: 7% of $295,000 = $20,650

**Line-by-line result:**

| | Amount |
|---|---|
| Sale price | $295,000 |
| Purchase | −$145,000 |
| Rehab | −$70,000 |
| Buying closing costs | −$2,175 |
| Points and lender fees | −$6,615 |
| Interest | −$9,025 |
| Taxes, insurance, utilities | −$4,200 |
| Selling costs | −$20,650 |
| **Net profit before income tax** | **about $37,300** |

**Calculator inputs for the same deal:** resale $295,000; purchase $145,000; rehab $70,000; 6 months; monthly holding about $2,204 (the $4,200 of carrying costs plus $9,025 of interest, divided by 6); buying and selling costs 10% (buying costs, selling costs, points and fees: $29,440 ÷ $295,000). The calculator returns a net profit of about $37,300.

**Return metrics:**

| Metric | Calculation | Result |
|---|---|---|
| Gross profit (headline style) | $295,000 − $145,000 | $150,000 |
| Net profit | from the table | about $37,300 |
| Net ROI on total cost | $37,300 ÷ $257,700 | about 14.5% |
| Margin on ARV | $37,300 ÷ $295,000 | about 12.7% |
| Your cash invested | $21,750 down + $2,175 closing + $6,615 points/fees + $9,025 interest + $4,200 carrying | about $43,800 |
| Cash-on-cash | $37,300 ÷ $43,800 | about 85% |
| Annualized ROI on cost (simple) | 14.5% × 12 ÷ 6 | about 29% |
| Annualized cash-on-cash (simple) | 85% × 12 ÷ 6 | about 170% |
| Break-even sale price | ($257,700 − $20,650) ÷ 0.93 | about $254,900 |

Notice the gap between the $150,000 gross spread and the $37,300 net. Notice also that 170% annualized cash-on-cash sounds wonderful and means very little on its own: it comes from borrowing about 90% of the cost, it ignores the reserves you should hold, and it assumes you can redeploy the money into an equally good deal the day this one closes.

**The more important number is break-even.** The sale price can fall from $295,000 to about $254,900, roughly 13.6%, before this deal loses money, assuming the hold stays at six months.

### When the flip runs long

Same deal, but permits and a slow listing push the hold to 9 months, and the lender charges a 1-point extension fee ($1,933) for the extra time:

| | 6 months | 9 months | 9 months and ARV 5% lower |
|---|---|---|---|
| Net profit | about $37,300 | about $28,000 | about $14,300 |
| Net ROI on total cost | about 14.5% | about 10.5% | about 5.4% |
| Annualized ROI on cost | about 29% | about 14% | about 7% |

Three months of delay cost about $9,300. Add a modest dip in the sale price and most of the profit is gone. This is why FlipRadar treats time as a cost line, not a scheduling detail.

## What the result means

- **Net profit** is before income taxes. How flip profit is taxed depends on your facts; see the [flip taxes guide](/guides/flip-taxes-short-term-gains-basics-not-tax-advice) and talk to a tax professional.
- **Net ROI on total cost** is your best single measure of how much margin the project has relative to the money at risk, including the lender's.
- **Margin on ARV** is useful for comparing deals of different sizes and for setting a minimum. Many investors set both a percentage floor and a dollar floor, because a 12% margin on a $120,000 house may not pay for the risk and work.
- **Cash-on-cash** shows what your own money earned. It rises with leverage, and so does your risk.
- **The 70% benchmark** tells you whether your purchase price is above or below a common screen. If you are above it, your detailed numbers have to justify why.

### Setting a target (illustrative)

FlipRadar does not publish "typical" net flip returns because we have not found a primary source that measures net profit after all costs. Industry reports such as ATTOM's measure **gross** profit (resale minus purchase). See [how much house flippers make](/guides/how-much-do-house-flippers-make) for what those reports do and do not say.

As an **illustrative** way to set your own targets:

| Situation | Illustrative target to consider |
|---|---|
| First flip, unproven crew, older house | A higher margin target and a dollar floor you would accept losing a year of weekends for |
| Experienced, repeatable cosmetic flips | A lower margin can work if timelines and costs are proven |
| Heavy rehab, permits, structural work | A higher margin, because the range of outcomes is wider |
| Hot market with stretched comps | A higher margin and a tighter purchase percentage |

These are not market data. Your targets should come from your own cost history and risk tolerance.

### Comparing two deals

Compare deals on four numbers together: net profit in dollars, net ROI on total cost, break-even cushion (how far the price can fall), and months of hold. A deal with a smaller profit but a shorter hold and a bigger cushion can be the better deal.

### How long a flip takes

ATTOM's Q2 2026 U.S. Home Flipping Report puts the typical time from purchase to resale at 161 days, and its 2025 year-end report puts the 2025 average at 163 days. That is a national figure across all flips, from light cosmetic work to heavy rehabs. Your own timeline depends on scope, permits, contractor availability and how fast your market absorbs listings. Plan with your own estimate, then add a cushion.

## Assumptions

- ARV is conservative and based on sold, adjusted comps.
- Rehab includes contingency.
- Monthly holding cost is constant across the hold. In reality, interest on draw-funded loans rises as draws are released.
- Buying and selling costs scale with the resale price. Some are fixed, so check small deals by hand.
- No income taxes are included.

## Limitations

- **Before-tax only.** Taxes can take a large share of net profit, and treatment depends on your facts.
- **No financing module.** Interest, points and fees must be entered through the holding and percentage inputs. The [hard money loan calculator](/tools/hard-money-loan-calculator) helps.
- **No cash-on-cash or annualized output.** Use the hand formulas above.
- **No time-overrun model.** Re-run the calculator with longer holds yourself.
- **Single scenario at a time.** Save your base, long-hold and lower-ARV runs and compare them.

## Common mistakes

1. **Confusing gross spread with profit.** Resale minus purchase is the start of the math.
2. **Leaving out financing costs.** Points and interest are real costs whether or not they show up on the closing statement.
3. **Forgetting buying-side closing costs.** You pay closing costs twice on a flip.
4. **Using the optimistic hold.** Use the realistic one, then test a longer one.
5. **Annualizing to justify a weak deal.** A short hold does not fix thin dollar profit.
6. **Ignoring the break-even cushion.** A deal with a 5% cushion is one soft month away from a loss.
7. **Counting your own labor as free.** If you do the work, the profit includes your wages. Know how much.
8. **Forgetting taxes when you plan your next deal.** Set aside money for taxes before you reinvest.

## FAQ

### How do you calculate profit on a house flip?

Subtract the purchase price, rehab, holding costs, financing costs, and buying and selling closing costs from the sale price. The result is net profit before income tax.

### What is the difference between gross and net flip profit?

Gross profit is usually the sale price minus the purchase price. Net profit subtracts everything else: rehab, interest, points, carrying costs and closing costs. Net is the number that pays you.

### What is a good ROI on a flip?

It depends on the risk, the hold and your experience. Set a minimum net margin on ARV and a minimum dollar profit, and make both larger for riskier scopes, older houses and hot markets. FlipRadar does not publish a "good" ROI because we have not found a reliable source for net returns.

### How do I calculate annualized ROI on a flip?

Multiply the return by 12 divided by the months held for a simple annualized figure, or use (1 + return) raised to (12 ÷ months) minus 1 for a compounded figure. Use annualized returns to compare deals with different timelines, not as a forecast.

### What is a break-even sale price?

The lowest sale price at which you still cover all costs. Divide your total cost (excluding selling costs) by one minus your selling cost percentage. The gap between ARV and break-even is your cushion.

### How long does a house flip take?

Nationally, ATTOM's Q2 2026 report puts the typical purchase-to-resale time at 161 days. Your own flip may be shorter or much longer depending on scope, permits and your market.

### Should loan interest go in holding costs?

Yes. In this calculator, include interest in monthly holding costs. Put one-time points and lender fees in the buying and selling cost percentage, or add them to rehab, so you count them once.

### Is flip profit taxed as capital gains or ordinary income?

It depends on your facts, including whether you are treated as a dealer and how the deal is held. Many flippers find their profit treated as ordinary income, and self-employment tax may apply. See the [flip taxes guide](/guides/flip-taxes-short-term-gains-basics-not-tax-advice) and confirm with a qualified tax professional.

### How do I compare two flip deals?

Look at net profit, net ROI on total cost, break-even cushion and hold time together. Prefer the deal that still makes money in the long-hold, lower-ARV scenario.

### Why is my profit lower than the 70% rule suggested?

Because the 70% rule's 30% buffer has to cover all of your closing, holding and financing costs before any profit. If your costs are higher than the rule assumes, your profit is lower. Build your own percentage with the [70% rule calculator](/tools/70-percent-rule-calculator).

---

**Related:** [How much house flippers make](/guides/how-much-do-house-flippers-make) · [Maximum Purchase Price guide](/guides/maximum-purchase-price) · [Holding costs on a 6-month flip](/guides/holding-costs-on-a-6-month-flip) · [Hard money loan calculator](/tools/hard-money-loan-calculator)

*Educational estimate only. Not financial, legal or tax advice. Verify costs with your lender, contractors, title company and a tax professional. Contact: save@sitesinc.co*
