from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Infrastructure
    database_url: str = "postgresql+asyncpg://nwsmedia:nwsmedia@localhost:5433/nwsmedia_leads"
    redis_url: str = "redis://localhost:6379/0"

    # Channel 1: Google Maps + Audit
    google_pagespeed_api_key: str = ""
    google_places_api_key: str = ""
    bright_data_proxy_url: str = ""
    captcha_api_key: str = ""
    hunter_api_key: str = ""
    instantly_api_key: str = ""
    instantly_campaign_id_maps: str = ""
    # Optional: set these to route leads to triage-specific campaigns (richer copy per variant)
    instantly_campaign_id_no_website: str = ""
    instantly_campaign_id_dead_website: str = ""
    instantly_campaign_id_has_website: str = ""

    # Channel 2: Yelp Fusion API
    yelp_api_key: str = ""
    yelp_daily_limit: int = 500

    # Channel 3 (was 2): LLC Filings + Direct Mail
    apollo_api_key: str = ""
    cobalt_api_key: str = ""
    snov_api_key: str = ""
    lob_api_key: str = ""
    lob_api_key_test: str = ""
    instantly_campaign_id_llc: str = ""
    sos_fl_data_path: str = ""
    sos_tx_data_path: str = ""

    # Channel 3: Craigslist Services
    craigslist_max_pages: int = 3
    craigslist_delay_min: float = 3.0
    craigslist_delay_max: float = 8.0
    craigslist_page_delay_min: float = 5.0
    craigslist_page_delay_max: float = 15.0
    craigslist_session_rotate_every: int = 20
    instantly_campaign_id_craigslist: str = ""

    # Daily summary email (Phase 4)
    summary_email_from: str = ""
    summary_email_password: str = ""
    summary_email_to: str = ""

    # Sender identity
    sender_name: str = "NWS Media"
    sender_title: str = "Founder"
    sender_phone: str = ""
    sender_company: str = "NWS Media"
    return_address_line1: str = ""
    return_address_city: str = ""
    return_address_state: str = ""
    return_address_zip: str = ""

    @property
    def sync_database_url(self) -> str:
        return self.database_url.replace("+asyncpg", "")


settings = Settings()
