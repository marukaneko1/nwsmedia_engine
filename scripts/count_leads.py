import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from src.config import settings


async def main() -> None:
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args={"statement_cache_size": 0, "command_timeout": 120},
    )
    async with engine.connect() as conn:
        total = (await conn.execute(text("SELECT COUNT(*) FROM businesses"))).scalar()
        cl = (
            await conn.execute(
                text("SELECT COUNT(*) FROM businesses WHERE source_channel = 'craigslist'")
            )
        ).scalar()
        other = (
            await conn.execute(
                text(
                    "SELECT COUNT(*) FROM businesses WHERE source_channel != 'craigslist' OR source_channel IS NULL"
                )
            )
        ).scalar()
    await engine.dispose()
    print(f"total_businesses={total}")
    print(f"craigslist={cl}")
    print(f"not_craigslist={other}")


if __name__ == "__main__":
    asyncio.run(main())
