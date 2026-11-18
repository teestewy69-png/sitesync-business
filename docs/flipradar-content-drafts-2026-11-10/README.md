# FlipRadar content drafts: 2026-11-10

**Status: draft-for-tony-review. Nothing was published.** Nothing on flipradar.co, Netlify, GitHub or the factory preview was changed, pushed or deployed. The factory-run folder (`/workspace/flipradar-factory-run-2026-11-10/`) was only read, never written. All files are Markdown with front matter (title, meta_description, h1, slug, page_type, status, word_count, related_live_url, sources).

Word counts are body-only: everything after the front matter, counted with `.wc.py` in this folder.

## File manifest

| File | Slug | Title | Words | Type | Gap filled |
|---|---|---|---|---|---|
| tools/arv-calculator.md | /tools/arv-calculator | Free ARV Calculator (2026): After Repair Value From Your Comps | 2,753 | Rewrite | Per-comp adjustments (paired sales), confidence range, comp selection rules (date, distance), methodology, limitations, whether lenders accept it, 10-question FAQ (live page had none) |
| tools/70-percent-rule-calculator.md | /tools/70-percent-rule-calculator | Free 70% Rule Calculator (2026): Maximum Allowable Offer at 65%, 70% or 75% | 2,383 | Rewrite | 65/70/75% side by side, sensitivity, wholesale fee, negative MAO, "is the 30% profit", closing costs, setting your own %, investor-type section, **corrected hot vs slow market rule** |
| tools/rehab-cost-estimator.md | /tools/rehab-cost-estimator | Free Rehab Cost Estimator (2026): House Flip Renovation Budget by Room | 2,800 | Rewrite | Illustrative room-by-room and scope cost tables, full-house worked example, timeline, cosmetic vs full gut, build your own price list; text matches the calculator's actual inputs |
| tools/flip-profit-calculator.md | /tools/flip-profit-calculator | Free Flip Profit Calculator (2026): Net Profit, ROI and Break-Even Price | 2,338 | Rewrite | Annualized ROI, break-even price, gross vs net, stress test, flip duration (ATTOM cited) |
| tools/hard-money-loan-calculator.md | /tools/hard-money-loan-calculator | Free Hard Money Loan Calculator (2026): Points, Interest, Draws and Total Cost | 2,340 | Rewrite | Draws and draw fees, interest on drawn vs full balance, LTC vs LTARV, borrower qualifications, underwriting documents and timeline, extensions |
| tools/brrrr-calculator.md | /tools/brrrr-calculator | Free BRRRR Calculator (2026): Cash Left in the Deal, Cash Flow and DSCR | 2,468 | Rewrite | Lender vs investor DSCR, capital recovery and "infinite return", refinance LTV, seasoning (Fannie Mae cited), refinance-cash tax note, glossary, pros/cons, good vs bad BRRRR |
| guides/how-to-estimate-arv-without-an-agent.md | /guides/how-to-estimate-arv-without-an-agent | How to Estimate ARV Without an Agent: Comps, Adjustments and Public Data | 1,867 | Rewrite | Public-data comp sourcing, adjustments, range; removed repeated boilerplate |
| guides/the-70-rule-when-it-works-and-when-it-breaks.md | /guides/the-70-rule-when-it-works-and-when-it-breaks | The 70% Rule: When It Works, When It Breaks, and What to Use Instead | 1,901 | Rewrite | Where the rule fails (cheap/expensive houses, long holds), hot/slow rule, fixed FAQ, removed double-counted holding costs |
| guides/maximum-purchase-price.md | /guides/maximum-purchase-price | Maximum Purchase Price Formula for House Flips (2026): Your Real Max Offer | 1,529 | **New** | MPP formula with price-dependent costs solved, worked example, stress test |
| guides/rehab-budget-line-items-most-flippers-forget.md | /guides/rehab-budget-line-items-most-flippers-forget | Rehab Budget Line Items Most Flippers Forget (2026 Checklist) | 1,696 | Rewrite | Full checklist, EPA lead-safe (RRP) rule cited, FAQ (live FAQ was empty) |
| guides/holding-costs-on-a-6-month-flip.md | /guides/holding-costs-on-a-6-month-flip | Holding Costs on a 6-Month Flip: What to Budget Each Month | 1,212 | Light refresh | Month-by-month interest table that matches the text, typo and 1031 fixes |
| guides/hard-money-vs-private-money-for-a-first-flip.md | /guides/hard-money-vs-private-money-for-a-first-flip | Hard Money vs Private Money for a First Flip: Terms, Costs and Risks | 1,801 | Rewrite | Consistent side-by-side cost example ($15,640 vs $11,137), lender question list, FAQ (live FAQ was empty) |
| guides/how-to-find-off-market-houses-to-flip.md | /guides/how-to-find-off-market-houses-to-flip | How to Find Houses to Flip: Off-Market Leads, MLS, Auctions and Lead Costs | 1,845 | Rewrite | MLS vs off-market, buying leads, REIA and agents, auctions and sheriff sales, online lead gen, FAQ (live FAQ was empty) |
| guides/brrrr-vs-flip-which-fits-your-capital.md | /guides/brrrr-vs-flip-which-fits-your-capital | BRRRR vs Flip: Which Fits Your Capital? Run the Same House Both Ways | 1,503 | Rewrite | Same house run both ways; new meta (live meta began "You are here: …") |
| guides/flip-taxes-short-term-gains-basics-not-tax-advice.md | /guides/flip-taxes-short-term-gains-basics-not-tax-advice | House Flipping Taxes: Dealer vs Investor, Ordinary Income and Self-Employment Tax (Not Tax Advice) | 2,023 | Rewrite | Both framings side by side, IRS-cited 15.3% SE tax, CPA question list, 1031 limit for dealer property |
| guides/how-much-do-house-flippers-make.md | /guides/how-much-do-house-flippers-make | How Much Do House Flippers Make? What 2025–2026 Data Says About Gross vs Net | 1,665 | **New** | Verified ATTOM figures, gross vs net, price band and metro spreads |
| guides/how-to-analyze-a-brrrr-deal.md | /guides/how-to-analyze-a-brrrr-deal | How to Analyze a BRRRR Deal: Work Backward From the Refinance (2026) | 1,865 | **New** | Backward solve from rent and refinance, three-way loan sizing, seasoning, delay cost, stress tests |
| hubs/home.md | / | Free House Flipping Calculators and Guides (2026): ARV, 70% Rule, Rehab, Profit | 1,100 | Rewrite | "Free … (2026)" title and meta, no-signup copy, FAQ (10), five-step flow, links to new guides |
| hubs/tools.md | /tools | Free House Flipping Calculators (2026): ARV, 70% Rule, Rehab, Profit, BRRRR | 692 | Rewrite | Removed internal labels ("competitor-benchmarked", "Underwriting Suite"), short intro per calculator, FAQ |
| hubs/guides.md | /guides | House Flipping Guides: ARV, 70% Rule, Rehab, Financing, BRRRR and Taxes | 610 | Rewrite | Removed word-count labels and the "Top 500 U.S. Cities" section, grouped guides with intros including the three new ones, FAQ |

Totals: 20 pages: 6 tools, 11 guides (3 new), 3 hubs. Tool pages are 2,338–2,800 words. Every tool and guide page follows the required section order and has an FAQ with 8–10 questions.

## Key fixes applied across the drafts

1. **70% rule, hot vs slow markets (Tony's rule):** tighten the percentage in a hot market; loosen it in a slower market only if the deal and the exit still protect margin. 60–65% and 75–80% are shown only as example ranges, with the reasoning. The live calculator page's Common mistakes #4 has this **inverted** (it says hot markets use 75–80%).
2. **No internal labels:** removed "Factory…", word-count badges, "words + live tool", "Worked Example + FAQ" labels, "competitor-benchmarked methodology", "Top 500 U.S. Cities".
3. **No breadcrumb metas:** the BRRRR vs flip meta that began "You are here:" has been replaced.
4. **Taxes:** both framings (investor capital gain vs dealer ordinary income plus possible SE tax) are presented side by side; neither is presented as settled. 15.3% is verified against and cited to the IRS.
5. **No repeated boilerplate:** the hard-money, permits and taxes blocks are gone from every page; each page links to the one page that covers the topic.
6. **One consistent hypothetical sample deal** across all pages (flip: ARV $295k, purchase $145k, rehab $70k, net ~$37.3k; rental: $85k purchase, $185k ARV, $1,950 rent). Math checked with Python.
7. Illustrative tables are labeled illustrative and tell readers to use local bids. No invented stats, testimonials or case studies. Contact is save@sitesinc.co only; no phone number, pricing, ads, affiliate links or checkout copy.

## Sources checked (all accessed 2026-11-10)

| Source | Used for | Pages |
|---|---|---|
| ATTOM, Q2 2026 U.S. Home Flipping Report press release, Oct 1, 2026, https://www.attomdata.com/news/market-trends/flipping/home-flipping-profits-continue-gradual-two-year-decline/ | Gross profit $60,526 (Q1 2026 $66,932; Q2 2025 $71,000); margin 21.5% (25.7%; 27.6%); 77,991 flips, 6.2% of sales (Q1 64,760 / 8%; Q2 2025 80,477 / 7.3%); 161 days (165; 166); price bands; large-metro high/low margins; CEO quote; methodology; 2026 coverage caveat | flipper income, flip profit, home |
| ATTOM, 2025 Year-End U.S. Home Flipping Report press release, Mar 19, 2026, https://www.attomdata.com/news/market-trends/flipping/2025-year-end-home-flipping-report/ | 297,045 flips (2024: 309,050), 7.4% of sales (7.6%); gross profit $65,981 (2024 $77,000); ROI 25.5% (32.1%), lowest since 2008; 2012 61.1%; median purchase $259,019, resale $325,000; 163 days (one day longer than 2024); Q4 2025 68,999 flips by 54,992 investors | flipper income, flip profit |
| IRS self-employment tax page | 15.3% = 12.4% + 2.9%; 2026 wage base $184,500; 0.9% additional Medicare; deductible half; $400 threshold | taxes |
| IRS Topic 409; Publication 544; Schedule SE instructions; estimated taxes page; Form 8824 instructions | Capital gain holding periods; dealer property not a capital asset; SE exclusion for capital-asset gains; estimated payments; no 1031 for property held primarily for sale | taxes |
| Fannie Mae Selling Guide B2-1.3-03, Cash-Out Refinance Transactions | Six months on title; existing first mortgage ≥12 months old; delayed financing exception | BRRRR calculator, BRRRR vs flip, BRRRR analysis |
| EPA Renovation, Repair and Painting Program page | Lead-safe rules for pre-1978 housing | rehab line items |

**Flipper-income page sources:** both ATTOM releases above. Only figures found on those pages are quoted. The 20–33% cost range is attributed exactly as ATTOM does ("flipping veterans estimate"), not as an ATTOM measurement. The page explicitly states there is no reliable public figure for typical net profit or annual flipper income and does not invent one.

## Could not verify / deliberately not used

- **Competitor statistics** (e.g., FlipperForce's "$66,000" profit figure and other competitor numbers in the scrape) were not used. The original sources weren't checked.
- **Whether cash-out refinance proceeds are taxable:** phrased as "generally not treated as income; ask a CPA". No IRS source was cited for this.
- **Dealer vs investor factors** are described as "commonly discussed" factors, not as an IRS test.
- **ATTOM full reports** (paid, county-level data) were not accessed; only the public press releases.
- **IRS 1031 landing page** returned 404; the Form 8824 instructions were used instead.
- **Hard money terms, DSCR minimums (1.20–1.25), closing-cost percentages and rehab cost ranges** are presented as hypothetical or illustrative, not as market data.
- No keyword volumes were checked.

## Open flags for Tony

1. **Tax wording needs CPA review** before publishing: the side-by-side framings, the SE tax "rough upper bound" example (~$5,700 on $37,300), and the refinance-proceeds note.
2. **Tax guide slug:** the live slug `/guides/flip-taxes-short-term-gains-basics-not-tax-advice` frames flips as short-term gains, which the new content no longer presents as settled. Recommendation: move to `/guides/house-flipping-taxes-basics` with a 301 from the old URL. The draft keeps the live slug for now; the URL was not changed.
3. **Live 70% calculator page has the hot/slow rule inverted** (Common mistakes #4). Fixed in the draft.
4. **Broken internal links on the live site:** /tools/after-repair-value-calculator, /tools/holding-cost-calculator, /tools/renovation, /tools/arv, /tools/flip-profit, /tools/flip-cost-calculator, /tools/flip-calculator, /guides/flip-costs-breakdown. The drafts link only to the slugs in this folder.
5. **Other live-site errors found:**
   - ARV page says holding costs are "8–12% of purchase price per month."
   - The 70% guide double-counts holding costs.
   - The holding-costs guide's interest table doesn't match its footnote, has a "Sholder" typo, and an incorrect 1031 mention.
   - The hard money guide's worked example is internally inconsistent.
   - FAQs on the rehab line-items, hard money and off-market guides are empty.
6. **Tool UI vs copy mismatches:**
   - The live rehab page text describes "scope level" inputs the calculator doesn't have. The draft matches the real inputs.
   - The hard money calculator charges interest on the full balance; the draft explains draw-based interest and shows both numbers.
   - The BRRRR calculator's all-in cost is purchase plus rehab only; the draft tells users to put other costs into the rehab field.
7. **Suggested tool enhancements (not built):**
   - ARV: per-comp adjustment fields and a range output.
   - 70%: wholesale fee field.
   - Flip profit: annualized return and break-even outputs.
   - Hard money: draw schedule and interest on drawn funds.
   - BRRRR: closing, holding and refinance-cost inputs and DSCR output.
8. **Fannie Mae seasoning:** the guide is cited for agency loans only. Many BRRRR investors use non-agency DSCR loans with different rules; the drafts say to confirm with the actual lender. Seasoning rules change, so re-check before publishing.
9. **ATTOM coverage caveat:** ATTOM expanded property record coverage in 2026, so flip counts may not compare cleanly with prior periods. Noted on the page. Re-check for a newer quarter (Q3 2026) before publishing.
10. **Hubs:** the "Top 500 U.S. Cities" local guides section was removed from the /guides hub draft. Decide whether those city pages stay; if they do, they need their own review.
11. **Home FAQ "Is FlipRadar free / no account":** keep only if accurate when published. The drafts don't make any claims about data storage.

## Confirmation

Nothing was published, deployed, pushed or changed on flipradar.co, Netlify, GitHub or the factory preview. These are local draft files only.
