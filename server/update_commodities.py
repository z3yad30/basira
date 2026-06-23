"""Update gold, silver, and Brent crude — scheduled every 15 minutes regardless of EGX hours."""
from update_data import download_commodities

if __name__ == "__main__":
    download_commodities()
