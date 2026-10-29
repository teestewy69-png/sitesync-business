import type { IndexableLocationSlug } from "@/data/indexable-location-slugs";
import { INDEXABLE_LOCATION_SLUGS } from "@/data/indexable-location-slugs";

export type CityFaq = {
  q: string;
  a: string;
};

export type CityPageCopy = {
  intro: string;
  tradesHeading: string;
  trades: string;
  areasHeading: string;
  areas: string;
  faqs: CityFaq[];
};

/**
 * Extra copy for the 20 indexed city pages only.
 * Facts: Census county (via the city record), well-known public geography,
 * and Sitesinc's Laguna Beach address. No invented stats, clients, reviews,
 * or a local office in that city.
 */
export const CITY_PAGE_CONTENT: Record<IndexableLocationSlug, CityPageCopy> = {
  "anaheim-ca": {
    intro:
      "Anaheim sits in Orange County around the Disneyland Resort, Angel Stadium, and the Honda Center. Hotels, restaurants, and shops along Harbor Boulevard and Katella Avenue serve visitors; Anaheim Hills and West Anaheim are mostly residential. A local site should say whether you work the Resort District, the Platinum Triangle, or neighborhoods farther from the parks.",
    tradesHeading: "Trades common in Anaheim",
    trades:
      "Hospitality and restaurant operators near the Resort District, contractors and landscapers in Anaheim Hills and West Anaheim, auto shops along Anaheim Boulevard and State College, and personal-care shops in strip centers are the usual small-business mix. Website design for contractors, plumbers, and barbers is the same $1,995 build as a hotel or restaurant — a working site you own, not a subscription.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name the parts of Anaheim you actually cover: the Resort District, Downtown Anaheim, the Colony, Anaheim Hills, West Anaheim, or the Platinum Triangle. Nearby cities people often list on the same site include Garden Grove, Orange, Fullerton, Santa Ana, and Buena Park. Only list cities you will drive to.",
    faqs: [
      {
        q: "Does Sitesinc have an office in Anaheim?",
        a: "No. Sitesinc is based at 1986 South Coast Hwy #3632, Laguna Beach, CA 92651 and builds websites online. We work with Anaheim businesses remotely. Submitting the form is a request, not a purchase.",
      },
      {
        q: "Should an Anaheim site mention Disneyland or the Resort District?",
        a: "Only if that is where you work. If you serve hotels, restaurants, or shops near the parks, say so. If you work Anaheim Hills or West Anaheim and never take Resort District jobs, name those neighborhoods instead. Do not invent a tourism claim you cannot back up.",
      },
      {
        q: "How much is a website for an Anaheim business?",
        a: "The Sitesinc website build is $1,995 flat. You pay 50% ($997.50) to start and 50% ($997.50) at launch. See website design and packages for what is included. Optional monitoring is separate: 1st month free • Card required at signup • $129/mo starting day 31 unless canceled before 30 days.",
      },
      {
        q: "Can the site list Garden Grove or Orange as service areas?",
        a: "Yes, if you actually work those cities. Put your real service area on the site the same way it appears on your Google Business Profile. We do not add extra city pages unless you ask and the work is in scope.",
      },
    ],
  },
  "chino-ca": {
    intro:
      "Chino is in San Bernardino County, south of Ontario and west of Eastvale, with Chino Hills in the hills to the west. The city still has agricultural and industrial land along Euclid and Kimball, and residential tracts toward Chino Hills and the 71. A useful site names whether you work the older central streets, the warehouse belt, or neighboring Chino Hills.",
    tradesHeading: "Trades common in Chino",
    trades:
      "Contractors, HVAC and plumbing shops, trucking and warehouse vendors, and storefronts along Central Avenue and Philadelphia Street are typical. Website design for contractors and plumbers in Chino is the same $1,995 flat build we do for other Inland Empire shops — you own the code, and there is no required subscription.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Say whether you cover central Chino, the industrial parks near the airport and Preserve, or you also take jobs in Chino Hills, Ontario, Eastvale, Montclair, and Pomona. Do not list a city you will not serve.",
    faqs: [
      {
        q: "Do you have an office in Chino?",
        a: "No. Sitesinc works from Laguna Beach, CA and builds sites remotely. We do not claim a Chino office or local staff.",
      },
      {
        q: "Should a Chino site also mention Chino Hills?",
        a: "Only if you take work there. They are neighboring cities with different streets and a different Google Business Profile area. List both only when that matches how you actually dispatch jobs.",
      },
      {
        q: "What does the $1,995 Chino website include?",
        a: "The $1,995 build includes a custom Next.js site, on-page SEO basics, a lead form, hosting setup, domain connection, and one revision round. Pay 50% to start and 50% at launch. Read website design and packages for the full list.",
      },
      {
        q: "Can I name warehouse or industrial customers on the site?",
        a: "Name the kinds of jobs you do (tenant improvements, refrigeration, fleet service) if they are true. Do not invent client names, testimonials, or a “preferred vendor” claim.",
      },
    ],
  },
  "corona-ca": {
    intro:
      "Corona is in western Riverside County at the 91 and 15, between the Santa Ana Mountains and the I-15 corridor toward Norco and Eastvale. South Corona, Dos Lagos, and Eagle Glen are newer residential areas; North Main and the older downtown sit closer to the 91. A local site should say which side of town you work.",
    tradesHeading: "Trades common in Corona",
    trades:
      "Roofing, general contracting, auto repair, landscaping, and storefront services along Main Street and McKinley are common. Website design for contractors, plumbers, and barbers is $1,995 flat — the same build as every other city, with your Corona service area written in plain language.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful labels include Downtown / North Main, South Corona, Eagle Glen, Dos Lagos, and the 15 corridor. Nearby cities shops often serve from the same truck are Norco, Eastvale, Riverside, and Anaheim Hills. List only the cities you actually cover.",
    faqs: [
      {
        q: "Is Sitesinc based in Corona?",
        a: "No. The business address is 1986 South Coast Hwy #3632, Laguna Beach, CA 92651. We build Corona websites online and do not have a Corona office.",
      },
      {
        q: "How should a Corona contractor describe the 91 and 15 corridor?",
        a: "Name the cities and neighborhoods you drive to. “West Riverside County” is fine if it is true; do not claim a commute time or a ranking as the top contractor on the 15.",
      },
      {
        q: "How much does a Corona website cost?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. Optional monitored SEO is not in that price. Details are on website design and packages.",
      },
      {
        q: "Can I include Norco or Eastvale on the same site?",
        a: "Yes, if you work those cities. Put the same service-area list on the site that you use on your Google Business Profile.",
      },
    ],
  },
  "costa-mesa-ca": {
    intro:
      "Costa Mesa is in coastal Orange County between Santa Ana, Newport Beach, and Huntington Beach. South Coast Plaza and the Theater District sit on the south side; Mesa Verde and the Westside are more residential. John Wayne Airport is next door in unincorporated Orange County. A site here should say whether you serve shoppers and offices around South Coast Plaza or neighborhoods farther north.",
    tradesHeading: "Trades common in Costa Mesa",
    trades:
      "Retail and restaurant operators around South Coast Plaza, contractors and remodelers in Mesa Verde, auto and industrial shops near the fairgrounds, and personal-care businesses on 17th Street and Newport Boulevard are typical. The $1,995 Sitesinc build is the same affordable website design we do for contractors, plumbers, and barbers in any Orange County city.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Eastside, Westside, Mesa Verde, South Coast Metro, or the Theater District if you work them. Nearby cities often grouped on one site are Newport Beach, Irvine, Santa Ana, Huntington Beach, and Fountain Valley. Only publish cities you will serve.",
    faqs: [
      {
        q: "Do you have a Costa Mesa office?",
        a: "No. Sitesinc is in Laguna Beach and works remotely. A Costa Mesa page is a service-area page, not a claim that we are located there.",
      },
      {
        q: "Should I mention South Coast Plaza if I do not work retail?",
        a: "No. Mention South Coast Plaza, the Theater District, or the airport only when those areas are part of your real jobs. Otherwise name the neighborhoods you actually cover.",
      },
      {
        q: "What is the price for a Costa Mesa website?",
        a: "The build is $1,995 one time. Pay 50% ($997.50) to start and 50% at launch. See packages for the invoice split and website design for what ships.",
      },
      {
        q: "Can the site cover Newport Beach and Irvine too?",
        a: "Yes, if that is your service area. Write it the same way you would tell a customer on the phone.",
      },
    ],
  },
  "fontana-ca": {
    intro:
      "Fontana is in southwestern San Bernardino County along the I-10 and I-15, with a large industrial and logistics footprint north of the freeway and residential tracts toward Sierra Lakes and Southridge. Neighboring cities include Rancho Cucamonga, Rialto, and Ontario. A Fontana site should say whether you work the warehouse belt, the older downtown, or the newer north-side neighborhoods.",
    tradesHeading: "Trades common in Fontana",
    trades:
      "Trucking, warehouse support, contractors, HVAC, auto repair, and neighborhood shops along Sierra and Valley Boulevard are common. Website design for contractors and plumbers is $1,995 flat. We do not invent a “logistics capital” ranking or job-count statistic — we just name the kinds of work that actually happen here.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful place names include Downtown Fontana, North Fontana, Sierra Lakes, Southridge, and the I-10 industrial parks. Nearby cities people often add are Rancho Cucamonga, Ontario, Rialto, Bloomington, and San Bernardino. List only what you cover.",
    faqs: [
      {
        q: "Does Sitesinc have a Fontana office?",
        a: "No. We are based in Laguna Beach, CA and build websites online. We do not staff a Fontana location.",
      },
      {
        q: "Can I say I serve warehouses and trucking companies?",
        a: "Yes, if that is your work. Describe the services (dock repair, fleet maintenance, tenant build-out) without invented client names or volume numbers.",
      },
      {
        q: "How much is the Fontana website build?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. Optional monitoring is extra. Read website design and packages.",
      },
      {
        q: "Should I list Rancho Cucamonga and Ontario?",
        a: "Only if you take those jobs. Matching the site to your Google Business Profile service area avoids confusing customers about where you actually go.",
      },
    ],
  },
  "garden-grove-ca": {
    intro:
      "Garden Grove is in north-central Orange County, between Anaheim, Westminster, Santa Ana, and Stanton. Harbor Boulevard, Chapman, and Brookhurst are the main commercial streets. The city has a well-known Korean business district along Garden Grove Boulevard. A local site should say which corridors and neighboring cities you cover.",
    tradesHeading: "Trades common in Garden Grove",
    trades:
      "Restaurants, auto shops, personal-care businesses, and contractors working older housing stock are typical along Brookhurst, Magnolia, and Harbor. Website design for barbers, plumbers, and contractors is the same $1,995 build — a site you own, written for the streets you actually serve.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name West Garden Grove, the Korean Business District, or the Harbor / Chapman corridors if that is accurate. Nearby cities often listed together are Anaheim, Westminster, Stanton, Santa Ana, and Fountain Valley.",
    faqs: [
      {
        q: "Is Sitesinc located in Garden Grove?",
        a: "No. Sitesinc’s address is in Laguna Beach. Garden Grove pages are for businesses that work there; they are not a local office claim.",
      },
      {
        q: "Can the site be written for Korean- or Vietnamese-speaking customers?",
        a: "We can put the language you actually use on the site (hours, phone, services) if you supply the copy. We do not invent bilingual claims or reviews.",
      },
      {
        q: "What does a Garden Grove website cost?",
        a: "The build is $1,995 flat. 50% to start, 50% at launch. See website design and packages. No long-term contract.",
      },
      {
        q: "Should I mention Little Saigon or Anaheim?",
        a: "Mention Westminster / Little Saigon or Anaheim only if you take work there. Keep the service-area list honest.",
      },
    ],
  },
  "huntington-beach-ca": {
    intro:
      "Huntington Beach is a coastal Orange County city on the Pacific, with Downtown and the pier at Main Street, Huntington Harbour to the northwest, and Oak View inland. Neighboring cities include Fountain Valley, Westminster, Costa Mesa, and Newport Beach. A beach-city site should say whether you serve the coast, the Harbour, or inland neighborhoods.",
    tradesHeading: "Trades common in Huntington Beach",
    trades:
      "Restaurants and shops downtown, marine and home-service contractors in the Harbour and along the canals, and personal-care businesses on Main Street and Beach Boulevard are common. Website design for contractors, plumbers, and barbers is $1,995 flat — the same offer as inland Orange County, with your coastal service area written clearly.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown / Main Street, Huntington Harbour, Oak View, or Seacliff if you work them. Nearby cities often grouped on one site are Fountain Valley, Westminster, Costa Mesa, Newport Beach, and Sunset Beach. Only list places you serve.",
    faqs: [
      {
        q: "Do you have an office in Huntington Beach?",
        a: "No. Sitesinc is based in Laguna Beach and builds sites remotely. We do not claim a Huntington Beach shop or staff.",
      },
      {
        q: "Should a Huntington Beach site talk about the pier or tourism?",
        a: "Only if visitors are your customers. A plumber who works Oak View does not need pier copy. A restaurant on Main Street should name Downtown and how to park or walk over.",
      },
      {
        q: "How much is a website for a Huntington Beach shop?",
        a: "The build is $1,995 one time, 50% to start and 50% at launch. Details on website design and packages.",
      },
      {
        q: "Can I list Fountain Valley and Westminster?",
        a: "Yes, when those cities are in your real service area. Match the site to your Google Business Profile.",
      },
    ],
  },
  "irvine-ca": {
    intro:
      "Irvine is a planned city in central Orange County, between Tustin, Lake Forest, Costa Mesa, and the Santa Ana Mountains. The Irvine Spectrum, University Town Center near UC Irvine, and village neighborhoods such as Woodbridge, Northwood, and Turtle Rock are the usual landmarks. A local site should name the villages or business parks you actually serve.",
    tradesHeading: "Trades common in Irvine",
    trades:
      "Professional offices, medical and dental practices, landscapers and home-service contractors in the villages, and restaurants around the Spectrum and UTC are typical. Website design for contractors, plumbers, and barbers is the same $1,995 flat build — affordable website design you own, with Irvine named where you work.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful village and center names include Woodbridge, Northwood, Turtle Rock, University Park, the Irvine Spectrum, and University Town Center. Nearby cities shops often add are Tustin, Lake Forest, Costa Mesa, Newport Beach, and Santa Ana.",
    faqs: [
      {
        q: "Does Sitesinc have an Irvine office?",
        a: "No. We work from Laguna Beach, CA and build websites online. An Irvine page is not a claim that we are located in the Spectrum or a business park.",
      },
      {
        q: "Should I name Irvine villages on the site?",
        a: "Yes, if you serve those villages. “Irvine and nearby Tustin” is enough if you do not want a long list. Do not invent HOA endorsements or “preferred vendor” status.",
      },
      {
        q: "How much does an Irvine website cost?",
        a: "The build is $1,995 flat. Pay 50% to start and 50% at launch. Optional SEO for small business monitoring is separate. See website design and packages.",
      },
      {
        q: "Is submitting the form a purchase?",
        a: "No. If we accept the project, we email a $997.50 start invoice. The remaining $997.50 is due at launch.",
      },
    ],
  },
  "long-beach-ca": {
    intro:
      "Long Beach is in southern Los Angeles County on San Pedro Bay, next to the Port of Long Beach and the border with Orange County at Seal Beach. Downtown, Belmont Shore, Bixby Knolls, and the neighborhoods around Signal Hill are the usual local landmarks. A Long Beach site should say whether you work the port, the shoreline, or inland neighborhoods.",
    tradesHeading: "Trades common in Long Beach",
    trades:
      "Port-adjacent contractors and industrial services, restaurants in Downtown and Belmont Shore, auto shops along Long Beach Boulevard and Pacific, and personal-care businesses in Bixby Knolls are common. Website design for contractors, plumbers, and barbers is $1,995 flat — one build, your service area, no subscription required to keep the site.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown, Belmont Shore, Belmont Heights, Bixby Knolls, California Heights, or the Westside if you work them. Nearby places often listed are Signal Hill, Lakewood, Carson, San Pedro, and Seal Beach. Only publish cities and neighborhoods you serve.",
    faqs: [
      {
        q: "Is Sitesinc in Long Beach?",
        a: "No. The company address is in Laguna Beach. We build Long Beach websites remotely and do not have a port or downtown office.",
      },
      {
        q: "Should a Long Beach site mention the Port?",
        a: "Only if port, terminal, or industrial work is part of what you do. A Belmont Shore shop can name 2nd Street and the peninsula instead.",
      },
      {
        q: "How much is a Long Beach website?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. See website design and packages for inclusions.",
      },
      {
        q: "Can I include Lakewood or Signal Hill?",
        a: "Yes, if you take those jobs. Write the list the same way you would tell a dispatcher.",
      },
    ],
  },
  "los-angeles-ca": {
    intro:
      "Los Angeles is the county seat of Los Angeles County. The city spans Downtown, Hollywood, the San Fernando Valley, the Westside, South Los Angeles, and East Los Angeles, among other areas. A Los Angeles site has to name the parts of the city you actually cover — “greater L.A.” without neighborhoods leaves a customer guessing.",
    tradesHeading: "Trades common in Los Angeles",
    trades:
      "Contractors, plumbers, electricians, auto shops, restaurants, and personal-care businesses operate in every region of the city. Website design for contractors, plumbers, and barbers is $1,995 flat. We will not invent a citywide ranking or a list of clients. We will put your real service area and phone number on the page.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Pick the areas you drive: Downtown, Hollywood, Silver Lake, the San Fernando Valley (Van Nuys, North Hollywood, Sherman Oaks), the Westside (Santa Monica-adjacent neighborhoods, West L.A., Culver City border), South Los Angeles, or East Los Angeles. Neighboring cities people often add are Pasadena, Glendale, Burbank, Inglewood, and Long Beach — only if you serve them.",
    faqs: [
      {
        q: "Do you have a Los Angeles office?",
        a: "No. Sitesinc is based in Laguna Beach, CA and builds websites online. We do not claim a Hollywood, Downtown, or Valley office.",
      },
      {
        q: "The city is huge. How specific should the service area be?",
        a: "Name the regions or neighborhoods you will actually take a job in. A Valley plumber should not list San Pedro unless that is true. Match the site to your Google Business Profile.",
      },
      {
        q: "How much does a Los Angeles website cost?",
        a: "The build is $1,995 one time. 50% ($997.50) to start, 50% at launch. Read website design and packages. Optional monitoring is extra.",
      },
      {
        q: "Do I own the site if I am in Los Angeles?",
        a: "Yes. You receive the full code and content when the build is complete. There is no long-term contract.",
      },
    ],
  },
  "newport-beach-ca": {
    intro:
      "Newport Beach is in coastal Orange County, with the Balboa Peninsula, Newport Harbor, Corona del Mar, Fashion Island, and Newport Coast as the usual place names. Costa Mesa, Irvine, and Huntington Beach sit inland or up the coast. A Newport Beach site should say whether you work the peninsula, the harbor islands, Corona del Mar, or Newport Coast.",
    tradesHeading: "Trades common in Newport Beach",
    trades:
      "Marine services and boat-related shops around the harbor, restaurants on the Balboa Peninsula and in Corona del Mar, contractors and remodelers, and professional offices near Fashion Island are typical. The $1,995 Sitesinc build is affordable website design for those shops — same price as inland Orange County, with your harbor or coast service area written honestly.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful names include Balboa Peninsula, Balboa Island, Newport Harbor, Corona del Mar, Fashion Island, and Newport Coast. Nearby cities often listed are Costa Mesa, Irvine, Huntington Beach, and Laguna Beach. List only what you serve.",
    faqs: [
      {
        q: "Is Sitesinc based in Newport Beach?",
        a: "No. We are in Laguna Beach, a short way down the coast, and we build websites online. A Newport Beach page is not a second office.",
      },
      {
        q: "Should I mention the harbor or Balboa if I work inland?",
        a: "No. Harbor and peninsula copy belongs on sites for businesses that work those areas. Inland or Fashion Island offices should name those instead.",
      },
      {
        q: "What is the Newport Beach website price?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. See website design and packages.",
      },
      {
        q: "Can Corona del Mar and Costa Mesa share one site?",
        a: "Yes, if you serve both. Write one clear service-area sentence rather than implying you have a shop in each place unless you do.",
      },
    ],
  },
  "ontario-ca": {
    intro:
      "Ontario is in southwestern San Bernardino County, home to Ontario International Airport and Ontario Mills. The I-10 and I-15 frame much of the city; downtown sits south of the airport. Neighboring cities include Rancho Cucamonga, Fontana, Montclair, Chino, and Eastvale. A local site should say whether you work the airport and warehouse belt, downtown, or the Mills retail area.",
    tradesHeading: "Trades common in Ontario",
    trades:
      "Logistics and warehouse vendors, contractors, HVAC, auto shops, and retail or restaurant operators around Ontario Mills are common. Website design for contractors and plumbers is $1,995 flat. We will name airport-adjacent or industrial work only if you do that work — no invented cargo-volume stats.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown Ontario, the airport / industrial parks, Ontario Mills, or south Ontario toward Chino if those are real. Nearby cities often grouped are Rancho Cucamonga, Fontana, Montclair, Upland, and Chino.",
    faqs: [
      {
        q: "Do you have an office in Ontario?",
        a: "No. Sitesinc’s address is in Laguna Beach. We build Ontario websites remotely.",
      },
      {
        q: "Should an Ontario site mention the airport or Ontario Mills?",
        a: "Mention them when they describe where you work (airport-area warehouses, Mills-adjacent retail). Skip them if you only serve residential streets downtown or in south Ontario.",
      },
      {
        q: "How much is an Ontario website?",
        a: "The build is $1,995 flat. 50% to start, 50% at launch. Full list on website design and packages."
      },
      {
        q: "Can I list Rancho Cucamonga and Fontana?",
        a: "Yes, if you take those jobs. Keep the list identical to how you describe your service area on Google.",
      },
    ],
  },
  "orange-ca": {
    intro:
      "Orange is in central Orange County, around the historic Old Towne Orange plaza and Chapman University. El Modena lies to the east; the city borders Anaheim, Santa Ana, Garden Grove, and Villa Park. A site here should say whether you work Old Towne, the university area, or the residential tracts toward Anaheim Hills and Tustin.",
    tradesHeading: "Trades common in Orange",
    trades:
      "Restaurants and shops on the Old Towne circle, contractors and plumbers in the surrounding neighborhoods, auto services on Tustin Street and Chapman, and personal-care businesses are typical. Website design for contractors, plumbers, and barbers is $1,995 flat — one price, you own the site.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful names include Old Towne Orange, El Modena, the Chapman University area, and east Orange toward Anaheim Hills. Nearby cities often listed are Anaheim, Santa Ana, Garden Grove, Tustin, and Villa Park.",
    faqs: [
      {
        q: "Does Sitesinc have an office in Orange?",
        a: "No. We are based in Laguna Beach and work remotely. We do not have a shop on the plaza or at The Outlets.",
      },
      {
        q: "Should a restaurant or shop mention Old Towne?",
        a: "Yes, if that is where you are. A contractor who never works the plaza can name east Orange or El Modena instead.",
      },
      {
        q: "How much does an Orange website cost?",
        a: "The build is $1,995 one time, paid 50% to start and 50% at launch. See website design and packages.",
      },
      {
        q: "Is the form a purchase?",
        a: "No. If we accept the project, you get a $997.50 start invoice by email. The rest is due at launch.",
      },
    ],
  },
  "pomona-ca": {
    intro:
      "Pomona is in eastern Los Angeles County, at the meeting of the 10, 57, and 71 freeways, next to Claremont, La Verne, Walnut, and the San Bernardino County line at Montclair. Downtown Pomona and the Arts Colony sit near Garey and Second; Phillips Ranch is a residential area to the southwest. A Pomona site should name downtown, Phillips Ranch, or the neighboring college-town corridor if that is where you work.",
    tradesHeading: "Trades common in Pomona",
    trades:
      "Auto shops, contractors, restaurants downtown, and services along Holt and Garey are common. Website design for contractors, plumbers, and barbers is the same $1,995 build we use in Orange and San Bernardino counties — flat price, you own the code.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown Pomona, the Arts Colony, Phillips Ranch, or south Pomona if accurate. Nearby cities often grouped are Claremont, La Verne, Diamond Bar, Walnut, Chino, and Montclair.",
    faqs: [
      {
        q: "Is Sitesinc in Pomona?",
        a: "No. The company is in Laguna Beach. A Pomona page does not mean we have a downtown or Phillips Ranch office.",
      },
      {
        q: "Can I mention the Fairplex or downtown events?",
        a: "Only if those events or that location matter to your customers. Do not invent sponsorships or “official vendor” status.",
      },
      {
        q: "What is the price for a Pomona website?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. See website design and packages.",
      },
      {
        q: "Should Claremont and La Verne be on the same site?",
        a: "Add them when you take those jobs. Keep the written service area aligned with your Google Business Profile.",
      },
    ],
  },
  "rancho-cucamonga-ca": {
    intro:
      "Rancho Cucamonga is in southwestern San Bernardino County, between Upland, Ontario, and Fontana, against the San Gabriel Mountains. Alta Loma and Etiwanda are well-known communities inside the city; Victoria Gardens is the main retail center on the east side. A local site should say whether you work Alta Loma, Etiwanda, Victoria Gardens, or the I-15 / I-10 edges.",
    tradesHeading: "Trades common in Rancho Cucamonga",
    trades:
      "Home-service contractors and landscapers in Alta Loma and Etiwanda, restaurants and shops at Victoria Gardens, and warehouse-adjacent trades toward Ontario and Fontana are typical. Website design for contractors, plumbers, and barbers is $1,995 flat.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful names include Alta Loma, Etiwanda, Victoria Gardens, and Terra Vista. Nearby cities often listed are Upland, Ontario, Fontana, and Claremont. Only publish cities you serve.",
    faqs: [
      {
        q: "Do you have a Rancho Cucamonga office?",
        a: "No. Sitesinc is based in Laguna Beach and builds websites online.",
      },
      {
        q: "Should I use Alta Loma or Etiwanda on the site?",
        a: "Yes, if those are the communities you work. Many customers still search those names even though they are part of the city.",
      },
      {
        q: "How much is a Rancho Cucamonga website?",
        a: "The build is $1,995 one time. 50% to start, 50% at launch. Details on website design and packages.",
      },
      {
        q: "Can Victoria Gardens be mentioned if I am not in the mall?",
        a: "Only as a landmark if it helps people find you (“east of Victoria Gardens”). Do not imply a storefront there unless you have one.",
      },
    ],
  },
  "riverside-ca": {
    intro:
      "Riverside is the county seat of Riverside County, inland from Orange County along the 91 and 215. Downtown, the Mission Inn Historic District, Magnolia Center, Canyon Crest, and the University of California, Riverside campus are the usual landmarks. A Riverside site should say which side of the city — downtown, Magnolia, Canyon Crest, or toward Jurupa Valley and Moreno Valley — you cover.",
    tradesHeading: "Trades common in Riverside",
    trades:
      "Contractors, auto shops along Magnolia and University, restaurants downtown and in Canyon Crest, and services around the UC Riverside area are common. Website design for contractors, plumbers, and barbers is $1,995 flat — SEO for small business starts with a clear city and phone number, not a ranking promise.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown, the Mission Inn Historic District, Magnolia Center, Canyon Crest, Mission Grove, or Arlington if you work them. Nearby cities often grouped are Corona, Norco, Jurupa Valley, Moreno Valley, and San Bernardino.",
    faqs: [
      {
        q: "Does Sitesinc have a Riverside office?",
        a: "No. We are in Laguna Beach and work remotely. We do not have a downtown or Canyon Crest office.",
      },
      {
        q: "Should I mention UC Riverside?",
        a: "Only if students, staff, or the campus area are part of your customers. A citywide contractor can just name the neighborhoods they dispatch to.",
      },
      {
        q: "How much does a Riverside website cost?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. See website design and packages.",
      },
      {
        q: "Can Corona and Moreno Valley be on the same site?",
        a: "Yes, if you serve them. Write one honest service-area list rather than implying a branch in each city.",
      },
    ],
  },
  "san-bernardino-ca": {
    intro:
      "San Bernardino is the county seat of San Bernardino County, at the 10, 215, and 210, below the San Bernardino Mountains. Downtown, the University District around California State University, San Bernardino, and neighborhoods such as Del Rosa sit inside the city; Highland and Redlands are next door. A local site should say whether you work downtown, the university area, or the east-side neighborhoods.",
    tradesHeading: "Trades common in San Bernardino",
    trades:
      "Contractors, auto repair, restaurants, and services along Baseline, Highland, and E Street are typical. Website design for contractors, plumbers, and barbers is $1,995 flat. We will not invent government-vendor status or downtown revitalization statistics.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Useful names include Downtown, the University District, Del Rosa, and north San Bernardino toward the foothills. Nearby cities often listed are Highland, Redlands, Rialto, Colton, and Fontana.",
    faqs: [
      {
        q: "Is Sitesinc based in San Bernardino?",
        a: "No. The address is 1986 South Coast Hwy #3632, Laguna Beach, CA 92651. We build San Bernardino websites online.",
      },
      {
        q: "Should I mention the county or downtown government offices?",
        a: "Only if that is your customer. Do not claim a county contract or preferred-vendor listing you do not have.",
      },
      {
        q: "What does a San Bernardino website cost?",
        a: "The build is $1,995 one time. Pay 50% to start and 50% at launch. Read website design and packages.",
      },
      {
        q: "Can Highland and Redlands share the site?",
        a: "Add them when you take those jobs. Keep the list aligned with your Google Business Profile.",
      },
    ],
  },
  "san-diego-ca": {
    intro:
      "San Diego is the county seat of San Diego County, on the Pacific south of Orange County and north of the Mexican border. Downtown, North Park, Pacific Beach, La Jolla, Mission Valley, and neighborhoods toward Chula Vista and El Cajon are the usual landmarks. A San Diego site has to name the communities you actually serve — the city is too large for a single unlabeled “San Diego” line.",
    tradesHeading: "Trades common in San Diego",
    trades:
      "Marine and tourism-adjacent shops near the bay, restaurants in North Park and Pacific Beach, contractors and plumbers across the mesas, and personal-care businesses in nearly every community are common. Website design for contractors, plumbers, and barbers is $1,995 flat. No invented visitor-count or ranking claims.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Pick the communities you cover: Downtown / Gaslamp, North Park, South Park, Pacific Beach, Mission Beach, La Jolla, Mission Valley, Clairemont, or neighborhoods toward Chula Vista, National City, La Mesa, and El Cajon. Only list places you will drive to.",
    faqs: [
      {
        q: "Do you have a San Diego office?",
        a: "No. Sitesinc is in Laguna Beach and builds websites remotely. A San Diego page is not a local office.",
      },
      {
        q: "How specific should a San Diego service area be?",
        a: "Name the communities you take jobs in. A Pacific Beach shop should not list East County unless that is true. Match Google Business Profile.",
      },
      {
        q: "How much is a San Diego website?",
        a: "The build is $1,995 flat, 50% to start and 50% at launch. See website design and packages. Optional monitoring is extra.",
      },
      {
        q: "Do I own the website?",
        a: "Yes. You get the full code and content when the build is complete. There is no long-term contract.",
      },
    ],
  },
  "santa-ana-ca": {
    intro:
      "Santa Ana is the county seat of Orange County, between Garden Grove, Tustin, Irvine, Costa Mesa, and Orange. Downtown Santa Ana and the civic center sit near Main and Broadway; South Coast Metro straddles the Costa Mesa line. A Santa Ana site should say whether you work downtown, the residential east side, or South Coast Metro.",
    tradesHeading: "Trades common in Santa Ana",
    trades:
      "Auto shops, contractors, restaurants, and personal-care businesses along Main, 17th, and First Street are typical. Website design for contractors, plumbers, and barbers is $1,995 flat — the same affordable website design as the rest of Orange County.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown Santa Ana, Floral Park, French Park, South Coast Metro, or the east side toward Tustin if those are real. Nearby cities often listed are Garden Grove, Orange, Tustin, Irvine, and Costa Mesa.",
    faqs: [
      {
        q: "Does Sitesinc have a Santa Ana office?",
        a: "No. We are based in Laguna Beach and work online. We do not have a civic-center or South Coast Metro office.",
      },
      {
        q: "Can the site use Spanish if that is how I talk to customers?",
        a: "Yes, if you supply the copy you want published. We will not invent bilingual reviews or a language we cannot support in the form.",
      },
      {
        q: "How much does a Santa Ana website cost?",
        a: "The build is $1,995 one time, 50% to start and 50% at launch. See website design and packages.",
      },
      {
        q: "Should I list Tustin and Garden Grove?",
        a: "List them when you serve them. Keep the written area the same as your Google Business Profile.",
      },
    ],
  },
  "upland-ca": {
    intro:
      "Upland is in southwestern San Bernardino County, against the San Gabriel Mountains, between Claremont, Rancho Cucamonga, and Ontario. Downtown Upland runs along 2nd Avenue and 9th Street; The Colonies is a newer area on the east side. A local site should say whether you work downtown, the foothill streets, or you also take jobs in Claremont and Rancho Cucamonga.",
    tradesHeading: "Trades common in Upland",
    trades:
      "Home-service contractors, landscapers, restaurants and shops downtown, and personal-care businesses are typical. Website design for contractors, plumbers, and barbers is $1,995 flat — a working site you own, written for the foothill cities you actually serve.",
    areasHeading: "Neighborhoods and areas served",
    areas:
      "Name Downtown Upland, The Colonies, or the north / foothill streets if accurate. Nearby cities often grouped are Claremont, Rancho Cucamonga, Ontario, Montclair, and San Antonio Heights.",
    faqs: [
      {
        q: "Do you have an Upland office?",
        a: "No. Sitesinc is in Laguna Beach and builds websites remotely. We do not have a downtown Upland shop.",
      },
      {
        q: "Should I mention Claremont or the Colleges?",
        a: "Only if you take Claremont jobs. Do not claim a campus contract or college endorsement.",
      },
      {
        q: "How much is an Upland website?",
        a: "The build is $1,995 flat. Pay 50% to start and 50% at launch. Details on website design and packages.",
      },
      {
        q: "Can Rancho Cucamonga and Ontario be on the same site?",
        a: "Yes, if that is your service area. Write it once, clearly, and keep it aligned with Google.",
      },
    ],
  },
};

export function getCityPageCopy(slug: string): CityPageCopy | null {
  if ((INDEXABLE_LOCATION_SLUGS as readonly string[]).includes(slug)) {
    return CITY_PAGE_CONTENT[slug as IndexableLocationSlug];
  }
  return null;
}
