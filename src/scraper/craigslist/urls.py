"""Craigslist city subdomain mapping and URL construction."""

CL_CITY_MAP: dict[str, str] = {
    # Tier 1
    "San Antonio, TX": "sanantonio",
    "Denver, CO": "denver",
    "Tampa, FL": "tampa",
    "Orlando, FL": "orlando",
    "Nashville, TN": "nashville",
    "Charlotte, NC": "charlotte",
    "Las Vegas, NV": "lasvegas",
    "Jacksonville, FL": "jacksonville",
    "Memphis, TN": "memphis",
    "Oklahoma City, OK": "oklahomacity",
    # Tier 2
    "Austin, TX": "austin",
    "Houston, TX": "houston",
    "Dallas, TX": "dallas",
    "Phoenix, AZ": "phoenix",
    "Tucson, AZ": "tucson",
    "Raleigh, NC": "raleigh",
    "Richmond, VA": "richmond",
    "Louisville, KY": "louisville",
    "Indianapolis, IN": "indianapolis",
    "Columbus, OH": "columbus",
    "Kansas City, MO": "kansascity",
    "Omaha, NE": "omaha",
    "Birmingham, AL": "bham",
    "Knoxville, TN": "knoxville",
    "Boise, ID": "boise",
    # Tier 3
    "Colorado Springs, CO": "cosprings",
    "Fort Worth, TX": "fortworth",
    "St. Petersburg, FL": "stpete",
    "Sarasota, FL": "sarasota",
    "Greenville, SC": "greenville",
    "Chattanooga, TN": "chattanooga",
    "Tulsa, OK": "tulsa",
    "Little Rock, AR": "littlerock",
    "Albuquerque, NM": "albuquerque",
    "El Paso, TX": "elpaso",
    "Bakersfield, CA": "bakersfield",
    "Fresno, CA": "fresno",
    "Wichita, KS": "wichita",
    "Spokane, WA": "spokane",
    "Des Moines, IA": "desmoines",
    # Tier 4
    "Atlanta, GA": "atlanta",
    "Miami, FL": "miami",
    "New Orleans, LA": "neworleans",
    "Salt Lake City, UT": "saltlakecity",
    "Portland, OR": "portland",
    "Sacramento, CA": "sacramento",
    "San Diego, CA": "sandiego",
    "Minneapolis, MN": "minneapolis",
    "Milwaukee, WI": "milwaukee",
    "Detroit, MI": "detroit",
    "Cleveland, OH": "cleveland",
    "Pittsburgh, PA": "pittsburgh",
    "Cincinnati, OH": "cincinnati",
    "St. Louis, MO": "stlouis",
    "Virginia Beach, VA": "norfolk",
    "Grand Rapids, MI": "grandrapids",
    "Baton Rouge, LA": "batonrouge",
    "Charleston, SC": "charleston",
    "Savannah, GA": "savannah",
    "Mobile, AL": "mobile",
    # Tier 5
    "Lexington, KY": "lexington",
    "Huntsville, AL": "huntsville",
    "Fayetteville, AR": "fayar",
    "Shreveport, LA": "shreveport",
    "Lubbock, TX": "lubbock",
    "Amarillo, TX": "amarillo",
    "Corpus Christi, TX": "corpuschristi",
    "McAllen, TX": "mcallen",
    "Laredo, TX": "laredo",
    "Midland, TX": "midland",
    "Pensacola, FL": "pensacola",
    "Tallahassee, FL": "tallahassee",
    "Gainesville, FL": "gainesville",
    "Lakeland, FL": "lakeland",
    "Cape Coral, FL": "ftmyers",
    "Columbia, SC": "columbia",
    "Augusta, GA": "augusta",
    "Macon, GA": "macon",
    "Wilmington, NC": "wilmington",
    "Asheville, NC": "asheville",
    "Provo, UT": "provo",
    "Ogden, UT": "ogden",
    "Reno, NV": "reno",
    "Bozeman, MT": "bozeman",
    "Billings, MT": "billings",
    "Sioux Falls, SD": "siouxfalls",
    "Fargo, ND": "fargo",
    "Cedar Rapids, IA": "cedarrapids",
    "Lincoln, NE": "lincoln",
    "Topeka, KS": "topeka",
    "Springfield, MO": "springfield",
    "Branson, MO": "springfield",
    "Rogers, AR": "fayar",
    "Bentonville, AR": "fayar",
    "Tyler, TX": "easttexas",
    "Beaumont, TX": "beaumont",
    "Killeen, TX": "killeen",
    "Abilene, TX": "abilene",
    "Anchorage, AK": "anchorage",
    "Honolulu, HI": "honolulu",
}

CL_CATEGORY_CODES: dict[str, str] = {
    "bbb": "All services",
    "bbs": "Small biz ads",
    "cps": "Computer services",
    "crs": "Creative services",
    "cys": "Cycle services",
    "evs": "Event services",
    "fgs": "Farm & garden services",
    "fns": "Financial services",
    "hss": "Household services",
    "lbs": "Legal services",
    "lgs": "Lessons & tutoring",
    "mas": "Marine services",
    "pas": "Pet services",
    "rts": "Real estate services",
    "sks": "Skilled trade services",
    "trs": "Travel/vacation",
}


def get_subdomain(city: str) -> str | None:
    """Return the CL subdomain for a city, or None if not mapped."""
    return CL_CITY_MAP.get(city)


def build_search_url(
    subdomain: str,
    category: str = "bbb",
    keyword: str | None = None,
    offset: int = 0,
    posted_today: bool = False,
) -> str:
    """Build a Craigslist services search URL."""
    url = f"https://{subdomain}.craigslist.org/search/{category}"
    params = []
    if keyword:
        params.append(f"query={keyword}")
    params.append("sort=date")
    if offset > 0:
        params.append(f"s={offset}")
    if posted_today:
        params.append("postedToday=1")
    if params:
        url += "?" + "&".join(params)
    return url


def extract_post_id(url: str) -> str | None:
    """Extract the numeric CL post ID from a listing URL.

    URLs look like: /fgs/d/austin-affordable-lawn-care/7915845636.html
    """
    import re

    match = re.search(r"/(\d{8,12})\.html", url)
    return match.group(1) if match else None
