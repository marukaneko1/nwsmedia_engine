"""High-value filter logic for Yelp leads.

The highest-converting profile is: unclaimed listing + no website + review_count
under 20 + in target category.  This identifies businesses that are real, active,
and completely without digital representation.
"""


def apply_filters(
    results: list[dict],
    *,
    unclaimed_only: bool = True,
    max_reviews: int = 50,
    require_website: bool = False,
    min_rating: float | None = None,
    max_rating: float | None = None,
    categories: list[str] | None = None,
) -> list[dict]:
    """Apply NWS high-value filters to raw Yelp results."""
    filtered: list[dict] = []

    for biz in results:
        if unclaimed_only and biz.get("is_claimed") is True:
            continue

        review_count = biz.get("review_count", 0)
        if review_count > max_reviews:
            continue

        if require_website and not biz.get("website"):
            continue

        rating = biz.get("rating")
        if min_rating is not None and rating is not None and rating < min_rating:
            continue
        if max_rating is not None and rating is not None and rating > max_rating:
            continue

        if categories:
            biz_cat = (biz.get("category") or "").lower()
            if not any(c.lower() in biz_cat for c in categories):
                continue

        filtered.append(biz)

    return filtered
