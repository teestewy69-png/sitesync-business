---
title: "Free ARV Calculator (2026): After Repair Value From Your Comps | FlipRadar"
meta_description: "Free ARV calculator, no signup. Enter three sold comps, adjust them for differences, and get an after repair value, a $/sq ft check and a confidence range."
h1: "ARV Calculator: Estimate After Repair Value From Sold Comps"
slug: /tools/arv-calculator
page_type: tool
status: draft-for-tony-review
word_count: 2753
related_live_url: https://flipradar.co/tools/arv-calculator
sources:
  - none (no outside statistics used; all figures are labeled hypothetical or illustrative)
---

The after repair value (ARV) is the price a fully renovated house should sell for in its local market. Every number downstream depends on it: your maximum offer, how much a lender will lend, your profit, and whether a BRRRR refinance gives your cash back. An ARV that is 5% too high can erase a flip's entire profit before you swing a hammer.

This calculator turns three sold comparable sales into an ARV, a price-per-square-foot check and a 70% rule screen. It works only with the numbers you enter. Free, no account, nothing to buy.

## Key takeaways

- ARV is an opinion of value built from **sold** comps, not list prices, Zestimates or what the seller hopes for.
- The quality of your comps matters more than the math. Three good comps beat ten loose ones.
- Adjust each comp for real differences (garage, bathrooms, condition, sale date) **before** you average.
- Read the spread between your comps as a confidence range. A tight spread is a usable ARV. A wide spread means you do not know the value yet.
- Underwrite at or slightly below the middle of your range, never at the top comp.
- A lender's appraiser sets the value the lender uses, not this calculator. Treat your ARV as your own ceiling, then check it against a professional opinion before you commit serious money.

## How to use the ARV calculator

1. **Enter the subject property's square footage.** Use above-grade finished living area as your local MLS and assessor report it. Leave out garages, porches and unfinished basements unless your local market routinely counts them.
2. **Pick three sold comps.** Use the comp rules below: similar size, same micro-market, recently sold, renovated to the level you plan.
3. **Adjust each comp's sale price for non-size differences.** If a comp has a two-car garage and your house has a one-car garage, subtract your local value for that difference from the comp's price. If the comp has one fewer half bath, add. Adjust for sale date if the market has moved since it closed. The calculator handles the size difference itself through price per square foot, so do **not** also adjust for square footage.
4. **Enter each comp's adjusted sale price and its square footage.**
5. **Read three outputs:** the estimated ARV, the average price per square foot (with each comp's figure listed), and a 70% rule max offer before repairs.
6. **Check the spread.** Multiply the lowest and highest per-comp $/sq ft by your subject's square footage. That is your confidence range.
7. **Carry the number forward** to the [70% rule calculator](/tools/70-percent-rule-calculator) or the [flip profit calculator](/tools/flip-profit-calculator), using the conservative end of your range.

## Inputs explained

| Input | What to enter | Where it comes from | Watch out for |
|---|---|---|---|
| Subject square footage | Finished, above-grade living area after the rehab | Assessor record, MLS history, your own measurement | Planned additions or a finished basement: only count space that will be permitted and counted by appraisers |
| Comp sold price (x3) | The closed sale price, adjusted for differences other than size | MLS sold data via an agent, county recorder, public portals cross-checked to the deed | Seller concessions inflate the recorded price. If a seller paid $10,000 of the buyer's costs, the real price was about $10,000 lower |
| Comp square footage (x3) | Finished living area of each comp, measured the same way as the subject | Same sources as above | Mixing sources (assessor for one, MLS for another) creates fake price differences |

### Comp selection rules

These are FlipRadar's working defaults. Loosen them only when you have to, and write down why.

| Rule | Default | When to stretch | What stretching costs you |
|---|---|---|---|
| Sale date | Closed within the last 90 days | Up to 6 months in thin markets | Older sales need a time adjustment and lower your confidence |
| Distance | Within about 0.5 mile in suburbs, a few blocks in cities | Up to 1 mile in rural or low-density areas | Crossing a major road, school boundary or subdivision line can change value more than distance does |
| Size | Within about 15–20% of the subject's square footage | Rarely | Price per square foot falls as houses get bigger, so a much smaller comp overstates your ARV |
| Beds and baths | Same count, or one bedroom or a half bath different | Only with a clear local adjustment | Bedroom count changes the buyer pool |
| Style and age | Same type (ranch vs two-story, detached vs attached), similar era | Rarely | A 1990s two-story is not a comp for a 1950s ranch |
| Condition | Renovated to the level you plan to deliver | Never use as-is or distressed sales as ARV comps | Using flips that were finished better than yours inflates your ARV |
| Sale type | Arm's-length retail sales | Exclude foreclosures, short sales, family transfers | Non-market sales distort the average either way |

Also pull **pending and active listings** in the same area. They are not comps, but they tell you what you will compete against when you list. If five renovated houses are sitting unsold at your ARV, your ARV is optimistic.

### Adjustments

An adjustment answers one question: what would this comp have sold for if it were exactly like the subject after the rehab? You adjust the comp, never the subject.

- **Comp is better than the subject:** subtract.
- **Comp is worse than the subject:** add.

Common adjustment categories:

- **Garage and parking.** Often one of the largest adjustments in suburbs.
- **Bathrooms.** A missing full bath can matter more than a missing bedroom in some markets.
- **Condition and finish level.** Quartz vs laminate, new vs original windows, finished vs unfinished.
- **Lot, view and location.** Backing to a busy road, a corner lot, a larger usable yard.
- **Sale date (time adjustment).** If prices in the micro-market moved since the comp closed, adjust for it. Use the change in recent sale prices in that area, not national headlines.
- **Concessions.** Subtract seller-paid buyer costs to get the true price.

The best source for adjustment dollar amounts is **paired sales**: two sales in the same area that differ mainly in one feature. If two similar houses sold a few weeks apart and the one with a two-car garage sold for $8,000 more, that is your local garage adjustment. A local agent or appraiser can also tell you what adjustments appraisers in that market tend to use. There is no national table that is accurate for your street, so FlipRadar does not publish one.

**Rule of thumb for your own discipline:** if a comp needs more than about 10–15% of its price in total adjustments, it is probably not a good comp. Replace it.

## Formula

The calculator uses the price-per-square-foot method on adjusted comps:

```
Comp $/sq ft (each)   = Adjusted comp sale price ÷ Comp square footage
Average comp $/sq ft  = (Comp 1 + Comp 2 + Comp 3 $/sq ft) ÷ 3
Estimated ARV         = Average comp $/sq ft × Subject square footage
Confidence range      = Lowest comp $/sq ft × Subject sq ft  to  Highest comp $/sq ft × Subject sq ft
70% screen            = Estimated ARV × 0.70   (before subtracting repairs)
```

The 70% figure shown here is a gross ceiling **before repairs**. Subtract your rehab budget to get a maximum allowable offer, which the [70% rule calculator](/tools/70-percent-rule-calculator) does for you.

### Methodology

FlipRadar uses a simple, transparent method on purpose:

1. You choose and adjust the comps. The tool does no automated comp selection and pulls no outside data.
2. Each comp's adjusted price is converted to price per square foot so comps of slightly different sizes can be compared.
3. The three comps are weighted equally.
4. The average is applied to the subject's square footage.
5. The spread of the three comps is your confidence range.

Equal weighting is a deliberate default. If one comp is clearly the best match (closest, most recent, same layout), you can weight it more heavily on paper. Just do it before you see which weighting gives the number you want.

## Worked example (hypothetical)

This sample property is used across FlipRadar's calculators and guides. All numbers are hypothetical and for illustration only.

**Subject:** 1,500 sq ft, 3 bed / 2 bath ranch built in 1968 with a one-car garage. Original kitchen and baths, 22-year-old roof. The plan is a mid-level rehab to match renovated homes in the neighborhood. Asking price: $185,000.

**Three sold, renovated comps:**

| | Comp A | Comp B | Comp C |
|---|---|---|---|
| Sold price | $305,000 | $289,000 | $296,000 |
| Square feet | 1,550 | 1,450 | 1,500 |
| Beds / baths | 3 / 2 | 3 / 1.5 | 3 / 2 |
| Sold | 45 days ago | 80 days ago | 120 days ago |
| Distance | 0.3 mile | 0.6 mile | 0.4 mile |
| Key difference | Two-car garage | One fewer half bath | Lighter renovation (kept original cabinets, painted) |

**Adjustments (hypothetical local values from paired sales):**

| | Comp A | Comp B | Comp C |
|---|---|---|---|
| Garage (comp better) | −$8,000 | — | — |
| Half bath (comp worse) | — | +$7,500 | — |
| Finish level (comp worse) | — | — | +$5,000 |
| Time (prices in the area softened slightly since Comp C sold) | — | — | −$3,000 |
| **Adjusted price** | **$297,000** | **$296,500** | **$298,000** |
| Adjusted $/sq ft | $191.61 | $204.48 | $198.67 |

**Calculator inputs:** subject 1,500 sq ft; Comp 1 $297,000 / 1,550; Comp 2 $296,500 / 1,450; Comp 3 $298,000 / 1,500.

**Outputs:**

- Average comp $/sq ft: about $198.25
- Estimated ARV: $198.25 × 1,500 ≈ **$297,400**
- Confidence range: $191.61 × 1,500 ≈ $287,400 to $204.48 × 1,500 ≈ $306,700
- 70% of ARV before repairs: about $208,200

**Cross-check with a second method.** Adjusting each comp for size directly (using a hypothetical $90 per sq ft for size differences, since added square footage is usually worth less than the average $/sq ft) gives adjusted prices of $292,500, $301,000 and $298,000, an average of about $297,200. The two methods agree within a few hundred dollars, which is a good sign.

**Underwriting decision:** Comp C is the oldest sale and needed two adjustments. Comp B needed a bath adjustment. The values cluster near $297,000, but the size-normalized range runs from about $287,000 to $307,000. A conservative investor would underwrite at **$295,000**: below the average, inside the range, and not dependent on the best comp. That $295,000 ARV carries through the rest of FlipRadar's sample deal.

## What the result means

Read the ARV together with the spread, not on its own.

| Spread between lowest and highest comp | What it suggests | What to do |
|---|---|---|
| Within about 5% | Comps agree. The ARV is usable for an offer | Underwrite at or slightly below the average |
| About 5–10% | Some disagreement | Find out why. Replace the outlier or get an agent's or appraiser's view |
| More than 10% | You do not know the value yet | Do not make a firm offer on this ARV. Find better comps or lower your ARV to the low end |

These bands are FlipRadar's working thresholds, not an industry standard. Set your own and stick to them.

Two more readings:

- **The 70% figure is not an offer.** It is a gross ceiling before repairs. Subtract the rehab budget and check the deal's real costs with the [Maximum Purchase Price guide](/guides/maximum-purchase-price).
- **If the ARV only works with the top comp,** the deal does not work.

## Assumptions

- The comps you entered are arm's-length, renovated, and comparable to the finished subject.
- Your adjustments reflect local buyer behavior, not personal taste.
- Value scales roughly with square footage inside the size band you chose. This holds reasonably well for comps within about 15–20% of the subject's size and breaks down outside it.
- The market at your sale date will look roughly like the market in your comps. On a six-month flip that is a forecast, not a fact.
- Your rehab will actually deliver the finish level of the comps.

## Limitations

- **Not an appraisal.** Only a licensed appraiser produces an appraisal. Lenders order their own and will not rely on this number.
- **Three comps, equal weights.** The tool does not weight comps automatically, enforce comp rules or flag outliers. You have to do that.
- **No data feed.** The calculator does not pull sales, verify prices or detect concessions.
- **Price per square foot is a blunt tool** for unusual houses: very large or very small homes, rural acreage, multifamily, mixed-use, historic homes, or anything with a unique feature (waterfront, major view, accessory unit).
- **Point in time.** The ARV reflects the comps you entered today. If the market moves during your hold, so does your ARV.
- **Garbage in, garbage out.** A well-built spreadsheet cannot fix a list-price comp or a distressed sale.

## Common mistakes

1. **Using list prices or active listings as comps.** Sellers ask; buyers decide. Only closed sales count as comps.
2. **Using an automated online estimate as the ARV.** Automated estimates are built for the typical house in its current condition, not a renovated flip. Use them only as a rough check.
3. **Comping against a nicer flip.** If the comp has quartz, new windows and a new roof, and your budget covers laminate and paint, your ARV is too high.
4. **Ignoring the size effect.** A 1,100 sq ft comp at $230/sq ft does not mean your 1,800 sq ft house is worth $230/sq ft.
5. **Crossing a boundary.** Same distance, different school zone or subdivision, different value.
6. **Forgetting concessions.** A $300,000 sale with $9,000 in seller credits is closer to a $291,000 sale.
7. **Picking comps to fit the deal.** If you chose comps after deciding you wanted the house, assume your ARV is high.
8. **No time adjustment in a moving market.** A comp from five months ago is a historical fact, not today's value.
9. **Treating ARV as one number.** Write down the range and the conservative figure you underwrote.

## FAQ

### What is ARV in real estate?

After repair value is the estimated market value of a property after planned repairs and renovations are complete. Investors use it to set a maximum offer, lenders use their own appraised version to size rehab loans, and BRRRR investors use it to estimate a refinance.

### How many comps do I need?

Three good comps is the minimum for a usable estimate. Five is better if they are all genuinely similar. Quality beats quantity: two excellent comps tell you more than five loose ones, and padding the list with weak comps just hides the uncertainty.

### How recent should comps be?

Aim for sales closed within about 90 days. In slow or thin markets you may need to go back six months, but then adjust for any price change since the sale and treat the result with less confidence.

### How far away can a comp be?

In suburbs, try to stay within about half a mile and inside the same subdivision or school zone. In dense cities, a few blocks can matter. In rural areas you may need a mile or more. Shared boundaries matter more than raw distance.

### Do lenders accept my ARV?

No. Hard money and rehab lenders typically order their own appraisal or broker price opinion with an "as-repaired" value, and they size the loan off their number. Your ARV is still useful: if your number and the lender's number disagree, you learn something before closing. If the lender's value comes in lower, the loan shrinks and you bring more cash.

### Should I use a Zestimate or other online estimate for ARV?

Not as your ARV. Online estimates model the house as it is today using broad data, not the renovated version you plan to deliver. They can be a quick reasonableness check, nothing more.

### What adjustments should I make to comps?

Adjust for meaningful differences buyers pay for: garage and parking, bathroom count, condition and finish level, lot and location factors, sale date, and seller concessions. Use paired sales or a local appraiser's typical adjustments for the dollar amounts.

### Why does the calculator use price per square foot?

It is transparent and easy to check, and it lets you compare comps of slightly different sizes. Its weakness is that price per square foot tends to fall as houses get larger, so keep comps close in size to the subject.

### What if my comps are far apart?

A spread over about 10% means the value is uncertain. Look for the reason: a different street, a different finish level, a concession, a different style. Replace the outlier if you can. If you cannot, underwrite at the low end or pass on the deal.

### How accurate is this ARV calculator?

It is exactly as accurate as the comps and adjustments you enter. The math is simple and shown above. The judgment is yours. For larger deals or unusual properties, get a local agent's opinion or pay for an appraisal before you commit.

---

**Related:** [How to estimate ARV without an agent](/guides/how-to-estimate-arv-without-an-agent) · [70% rule calculator](/tools/70-percent-rule-calculator) · [Maximum Purchase Price guide](/guides/maximum-purchase-price) · [Flip profit calculator](/tools/flip-profit-calculator)

*Educational estimate only. Not an appraisal, a loan offer, or financial, legal or tax advice. Verify with local sold data, contractors, your lender and your title company before making an offer. Contact: save@sitesinc.co*
