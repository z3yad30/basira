import os
import re
import json
import time
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import requests
import pandas as pd

# ─── Configuration ───────────────────────────────────────────────────────────

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EGX_STOCKS_JSON = os.path.join(BASE_DIR, "egx_stocks.json")
STOCK_DATA_OUTPUT_DIR = os.path.join(BASE_DIR, "..", "stock_data", "stock_data")

# Twelve Data API configuration
TWELVE_DATA_API_KEY = os.environ.get("TWELVE_DATA_API_KEY", "8499a1a2877c40019227aaf2db986ed0")
TWELVE_DATA_BASE_URL = "https://api.twelvedata.com"
BATCH_SIZE = 120  # Twelve Data supports up to 120 symbols per batch request
RATE_LIMIT_DELAY = 8  # seconds between batch calls (8 req/min on free tier)

# ─── Ticker Registries ───────────────────────────────────────────────────────

# EGX stocks, indices, FX, and WTI — updated during market hours
egx_tickers = {
    "AALR.CA": "General Company For Land Reclamation, Development & Reconstruction",
    "ABUK.CA": "Abu Qir Fertilizers and Chemical Industries",
    "ACAMD.CA": "Arab Co. for Asset Management And Development",
    "ACAP.CA": "A Capital Holding",
    "ACGC.CA": "Arabia Cotton Ginning Company",
    "ACTF.CA": "Act Financial",
    "ADCI.CA": "The Arab Drug Company",
    "ADIB.CA": "Abu Dhabi Islamic Bank – Egypt",
    "ADPC.CA": "The Arab Dairy Products Co.",
    "AFDI.CA": "Al Ahly for Development & Investment",
    "AFMC.CA": "Alexandria Flour Mills",
    "AIDC.CA": "Arabia for Investment and Development S.A.E.",
    "AIHC.CA": "Arabia Investments Holding",
    "AJWA.CA": "AJWA For Food Industries Co. Egypt",
    "ALAR.CA": "Al Arafa Investment And Consulting in EGP",
    "ALCN.CA": "Alexandria Container and Cargo Handling",
    "ALEX.CA": "Alexandria Cement",
    "ALRA.CA": "Atlas for Investment & Food Industries",
    "ALUM.CA": "Arab Aluminum Company (S.A.E)",
    "AMER.CA": "Amer Group Holding",
    "AMES.CA": "Alexandria New Medical Center",
    "AMIA.CA": "Arab Moltaqa Investments Company",
    "AMOC.CA": "Alexandria Mineral Oils Company",
    "ANCC.CA": "ALNAHDA Industrial Co.",
    "ANFI.CA": "Tycoon Holding Company For Financial Investments",
    "APPC.CA": "Advanced Pharmaceutical Packaging Co.",
    "APSW.CA": "Unirab Polvara Spinning & Weaving Co.",
    "ARAB.CA": "Arab Developers Holding",
    "ARCC.CA": "Arabian Cement Company S.A.E.",
    "AREH.CA": "Real Estate Egyptian Consortium",
    "ARVA.CA": "Arab Valves Company",
    "ASCM.CA": "ASEC Company for Mining ASCOM, S.A.E",
    "ASCOM.CA": "Asek Company For Mining - Ascom",
    "ASPI.CA": "Aspire Capital Holding for Financial Investments",
    "ATLC.CA": "Al Tawfeek Leasing Company",
    "ATLP.CA": "Atlas For Land Reclamation And Agricultural Processing",
    "ATQA.CA": "Misr National Steel - Ataqa",
    "AUTO.CA": "Ghabbour Auto (GB Auto)",
    "AXPH.CA": "Alexandria Co. For Pharmaceuticals & Chemical Industries",
    "BIDI.CA": "El Badr Investment and Development - BID",
    "BIGP.CA": "ElBarbary Investment Group",
    "BINV.CA": "B Investments Holding S.A.E.",
    "BIOC.CA": "GlaxoSmithKline S.A.E",
    "BONY.CA": "Bonyan for Development and Trade",
    "BSRD.CA": "Brothers Solidarity For Real Estate Investment And Food Security",
    "BTCH.CA": "Beltone Capital Holding For Financial Investments",
    "BTFH.CA": "Beltone Holding S.A.E",
    "CAED.CA": "Cairo Educational Services SAE",
    "CANA.CA": "Suez Canal Bank (S.A.E)",
    "CCAP.CA": "QALA For Financial Investments",
    "CCRS.CA": "Gulf Canadian Company for Arab Real Estate Investment",
    "CDEV.CA": "Cairo Development and Investment",
    "CEFM.CA": "Middle Egypt Flour Mills",
    "CERA.CA": "The Arab Ceramic Co.",
    "CERP.CA": "Ceramic & Porcelain",
    "CFGH.CA": "Concrete Fashion Group For Commercial and Industrial Investments",
    "CICH.CA": "CI Capital Holding For Financial Investments (S.A.E)",
    "CIEB.CA": "Credit Agricole - Egypt Bank (S.A.E.)",
    "CIRA.CA": "Cairo For Investment And Real Estate Developments-CIRA Education",
    "CLHO.CA": "Cleopatra Hospitals Group S.A.E.",
    "CNFN.CA": "Contact Financial Holding S.A.E.",
    "COMI.CA": "Commercial International Bank (CIB) S.A.E.",
    "COPR.CA": "Copper for Commercial Investment & Real Estate Development",
    "COSG.CA": "Cairo Oil & Soap Company",
    "CPCI.CA": "Kahira Pharmaceuticals & Chemical Industries Company",
    "CPME.CA": "Catalyst Partners",
    "CRST.CA": "Creast Mark For Contracting And Real Estate Development",
    "CSAG.CA": "Canal Shipping Agencies Company",
    "DAPH.CA": "Development & Engineering Consultants",
    "DCCC.CA": "Damietta Container & Cargo Handling Co.",
    "DCRC.CA": "Delta Construction & Rebuilding",
    "DEIN.CA": "Delta Insurance Company",
    "DGTZ.CA": "I Wave Beyond Your Expectations",
    "DOMT.CA": "Arabian Food Industries Company (DOMTY) - S.A.E",
    "DSCW.CA": "Dice For Ready-Made Garments (SAE)",
    "DTPP.CA": "Delta Co. For Printing & Packaging S.A.E",
    "EALR.CA": "Arab Company For Land Reclamation",
    "EASB.CA": "Egyptian Arabian Company (Themar) for Securities Brokerage EAC",
    "EAST.CA": "Eastern Company S.A.E",
    "EBSC.CA": "Osool ESB Securities Brokerage",
    "ECAP.CA": "Al Ezz Ceramics & Porcelain Co. (Gemma)",
    "EDFM.CA": "East Delta Flour Mills Co.",
    "EEII.CA": "Arab Engineering Industries",
    "EFIC.CA": "Egyptian Financial and Industrial SAE",
    "EFID.CA": "Edita Food Industries Company (S.A.E)",
    "EFIH.CA": "E-finance for Digital and Financial Investments S.A.E.",
    "EGAL.CA": "Egypt Aluminum",
    "EGAS.CA": "Egypt Gas Company SAE",
    "EGBE.CA": "Egyptian Gulf Bank (S.A.E)",
    "EGCH.CA": "Egyptian Chemical Industries",
    "EGREF.CA": "Egyptians Real Estate Fund",
    "EGSA.CA": "The Egyptian Satellite Company Nilesat",
    "EGTS.CA": "Egyptian Resorts Company (S.A.E)",
    "EGYC.CA": "Egyptian Company for Mobile Services (ECMS)",
    "EHDR.CA": "Egyptians for Housing & Development Co.",
    "EICO.CA": "Engineering Industries (Icon)",
    "ELEC.CA": "Electro Cable Egypt",
    "ELKA.CA": "Cairo for Housing and Development Company (S.A.E)",
    "ELNA.CA": "El Nasr Manufacturing Agricultural Crops S.A.E",
    "ELSA.CA": "El Saeed Contracting and Real Estate Investment",
    "ELSH.CA": "Al Shams Housing and Urbanization SAE",
    "ELWA.CA": "El Wadi for International and Investment Development SAE",
    "EMFD.CA": "Emaar Misr for Development Company (S.A.E.)",
    "ENGC.CA": "Industrial Engineering Company for Construction and Development (ICON) (S.A.E)",
    "EOSB.CA": "El Orouba Securities Brokerage",
    "EPCO.CA": "Egypt for Poultry",
    "EPPK.CA": "El Ahram Co. For Printing And Packaging SAE",
    "ETEL.CA": "Telecom Egypt Company",
    "ETRS.CA": "Egyptian Transport and Commercial Services Company S.A.E.",
    "EXOD.CA": "Extracted Oils & Derivatives",
    "EXPA.CA": "Export Development Bank of Egypt (S.A.E.)",
    "EZST.CA": "Ezz Steel",
    "FAIT.CA": "Faisal Islamic Bank of Egypt",
    "FAITA.CA": "Faisal Islamic Bank of Egypt - Preferred",
    "FASI.CA": "Faisal Islamic Bank Of Egypt (USD)",
    "FAWR.CA": "Fawry for Banking Technology and Electronic Payment",
    "FERC.CA": "Ferchem Misr for Fertilizers and Chemicals S.A.E",
    "FIRD.CA": "First Investment And Real Estate Development",
    "FWRY.CA": "Fawry for Banking Technology and Electronic Payments S.A.E.",
    "GBCO.CA": "GB Corp",
    "GDWA.CA": "Gadwa for Industrial Development",
    "GENI.CA": "Genial Tours",
    "GGCC.CA": "Giza General - Contracting and Real Estate Investment S.A.E",
    "GGRN.CA": "Go Green For Agricultural Investment And Development",
    "GIHD.CA": "Gharbia Islamic Housing Development Company",
    "GMCI.CA": "GMC Group For Industrial Commercial & Financial Investments",
    "GOLD.CA": "Golden Coast Company",
    "GOUR.CA": "Gourmet Egypt.Com Foods",
    "GPIM.CA": "GPI for Urban Growth",
    "GPPL.CA": "Golden Pyramids Plaza S.A.E.",
    "GRCA.CA": "Grand Capital for Financial Investments",
    "GSSC.CA": "General Co. For Silos & Storage",
    "GTEX.CA": "GTEX for Commercial and Industrial Investments S.A.E",
    "GTWL.CA": "Golden Textiles & Clothes Wool",
    "GULF.CA": "Gulf Arab Investment",
    "HBCO.CA": "Heibco Npv",
    "HDBK.CA": "Housing and Development Bank- Egypt (S.A.E)",
    "HELI.CA": "Heliopolis Co. for Housing & Development",
    "HRHO.CA": "EFG Holding Company S.A.E",
    "IBCT.CA": "International Business Corporation For Trade And Franchise",
    "ICAI.CA": "Inter-Cairo For Aluminum Industry",
    "ICID.CA": "International Co. For Investment & Development",
    "ICLE.CA": "International Company for Leasing S.A.E.",
    "ICMI.CA": "International Company For Medical Industries",
    "IDRE.CA": "Ismailia Development and Real Estate Co",
    "IDRY.CA": "International Dry Ice",
    "IEEC.CA": "International Electrical Engineering Company",
    "IENG.CA": "Integrated Engineering Group Sae",
    "IFAP.CA": "International Company for Agricultural Crops",
    "INDU.CA": "Indus & Engineer",
    "INFI.CA": "Ismailia National Co. for Food Industries",
    "IPPM.CA": "International Printing & Packaging Materials Co.",
    "IRON.CA": "Egyptian Iron and Steel Company",
    "ISDV.CA": "Ismailia Development And Real Estate",
    "ISMA.CA": "Ismailia / Misr Poultry Company S.A.E",
    "ISMQ.CA": "Iron & Steel for Mines & Quarries",
    "ISPH.CA": "Ibnsina Pharma",
    "ITSY.CA": "IT Synergy",
    "JUFO.CA": "Juhayna Food Industries S.A.E.",
    "KABO.CA": "El-Nasr Clothing & Textiles Co. (KABO)",
    "KRDI.CA": "AlKhair River for Development Agricultural Investment and Environmental Services",
    "KWIN.CA": "El Kahera El Watania Investment",
    "KZPC.CA": "Kafr El Zayat For Pesticides & Chemicals Co.(S.A.E)",
    "LCSW.CA": "Lecico Egypt (S.A.E.)",
    "LKAH.CA": "Lakah Group",
    "LUTS.CA": "Lotus Agri Capital",
    "MAAL.CA": "Marseille Almasreia Alkhalegeya For Holding Investment SAE",
    "MANP.CA": "Mansoura Poultry",
    "MASR.CA": "Madinet Masr For Housing and Development",
    "MBEG.CA": "MB for Engineering & Contracting",
    "MBEN.CA": "MB Engineering",
    "MBSC.CA": "Misr Beni Suef Cement Co. S.A.E",
    "MCDR.CA": "Misr for Central Clearing, Depository and Registry",
    "MCQE.CA": "Misr Cement (Qena) Company (S.A.E)",
    "MCRO.CA": "Macro Group Pharmaceuticals (Macro Capital) S.A.E",
    "MEDN.CA": "Medinet Nasr Housing",
    "MEDP.CA": "Medical Packaging Company",
    "MEGM.CA": "Middle East Glass Manufacturing Company S.A.E.",
    "MEMPH.CA": "Memphis Pharmaceuticals",
    "MENA.CA": "Mena for Touristic & Real Estate Investment",
    "MEPA.CA": "Middle East Pharmaceutical Industries",
    "MFPC.CA": "Misr Fertilizer Production Company (MOPCO)",
    "MFSC.CA": "Egypt Free Shops Co.",
    "MHOT.CA": "Misr Hotels Company",
    "MICH.CA": "Misr Chemical Industries Co.",
    "MILS.CA": "North Cairo Flour Mills",
    "MIPH.CA": "MINAPHARM Pharmaceuticals",
    "MMAT.CA": "Marsa Marsa Alam For Tourism Development SAE",
    "MMGR.CA": "MM Group For Industry And International Trade",
    "MOED.CA": "The Egyptian Modern Education Systems, S.A.E.",
    "MOIL.CA": "Maridive and Oil Services S.A.E.",
    "MOIN.CA": "Mohandes Insurance Company",
    "MOSC.CA": "Misr Oils & Soap",
    "MPCI.CA": "Memphis Pharmaceuticals & Chemical Industries",
    "MPCO.CA": "Mansoura Poultry co.S.A.E",
    "MPRC.CA": "Egyptian Media Production City",
    "MTIE.CA": "MM Group for Industry and International Trade S.A.E.",
    "NAHO.CA": "Naeem Holding Company For Investments (S.A.E - Free Zone)",
    "NAPR.CA": "National Printing Company S.A.E.",
    "NARE.CA": "Naeem Real Estate Holding Group",
    "NCCW.CA": "Nasr Company for Civil Works",
    "NDRL.CA": "National Drilling Company",
    "NEDA.CA": "Northern Upper Egypt For Development & Agricultural Production Co.",
    "NHPS.CA": "National Company for Housing Professional Syndicates SAE",
    "NINH.CA": "Nozha International Hospital",
    "NIPH.CA": "EI- Nile Co. for Pharmaceuticals and Chemical Industries",
    "OBRI.CA": "Obour Land for Food Industries",
    "OCDI.CA": "Sixth of October for Development and Investment Company \"SODIC\" (S.A.E.)",
    "OCPH.CA": "October Pharma S.A.E",
    "ODIN.CA": "ODIN Investments (S.A.E)",
    "OFH.CA": "O B Financial Holding S.A.E",
    "OIH.CA": "Orascom Investment Holding S.A.E.",
    "OLFI.CA": "El-Ebour Co. for Real Estate Investment S.A.E.",
    "ORAS.CA": "Orascom Construction PLC",
    "ORHD.CA": "Orascom Development Egypt S.A.E.",
    "ORHO.CA": "Orascom Hotels And Development",
    "ORWE.CA": "Oriental Weavers Carpets Company (S.A.E)",
    "OSOL.CA": "Osool ESB Securities Brokerage - Alternative",
    "PAIC.CA": "Paint & Chemicals Industries",
    "PAME.CA": "Paper Middle East (Simo)",
    "PHAR.CA": "Egyptian International Pharmaceutical Industries Company",
    "PHGC.CA": "Premium Healthcare Group",
    "PHDC.CA": "Palm Hills Developments S.A.E.",
    "PHTV.CA": "Pyramisa Hotels & Resorts",
    "POCO.CA": "Port Said Containers And Cargo Handling Co.",
    "POUL.CA": "Cairo Poultry Company S.A.E.",
    "PRCL.CA": "The General Company for Ceramic and Porcelain Products",
    "PRDC.CA": "Pioneers Properties For Urban Development - PRE Group",
    "PRME.CA": "Prime Holding",
    "PRMH.CA": "Prime Holding S.A.E",
    "QNBE.CA": "Qatar National Bank",
    "RACC.CA": "Raya Customer Experience",
    "RAKT.CA": "Rakta Paper Manufacturing Company",
    "RAMD.CA": "Tenth of Ramadan for Pharmaceutical Industries and Diagnostic Reagents - Rameda",
    "RAYA.CA": "Raya Holding Company for Financial Investments (S.A.E)",
    "RBRE.CA": "Rubex for Plastic Manufacturing",
    "RMDA.CA": "Tenth of Ramadan for Pharmaceutical Industries and Diagnostic Reagents (Rameda) (S.A.E)",
    "ROTO.CA": "Rowad Tourism Company",
    "RREI.CA": "Arab Real Estate Investment Co.",
    "RTVC.CA": "Remco Tourism Villages Construction",
    "RUBX.CA": "Rubex International for Plastic and Acrylic Manufacturing",
    "SAIB.CA": "Société Arabe Internationale de Banque S.A.E",
    "SAUD.CA": "alBaraka Bank Egypt S.A.E.",
    "SARW.CA": "Sarwa Capital",
    "SCEM.CA": "Sinai Cement Co. (S.A.E)",
    "SCFM.CA": "South Cairo and Giza Flour Mills and Bakeries Company",
    "SCTS.CA": "Suez Canal Company for Technology Settling (S.A.E)",
    "SDTI.CA": "SHARM DREAMS Co. for Touristic Investment S.A.E",
    "SEIG.CA": "Saudi Egyptian Investment & Finance Co. S.A.E",
    "SEIGA.CA": "Saudi Egyptian Investment & Finance Co. S.A.E - Preferred",
    "SHOR.CA": "Shorouk for Modern Printing and Packaging",
    "SIPC.CA": "Sabaa International Company for Pharmaceutical and Chemical Industry",
    "SKPC.CA": "Sidi Kerir Petrochemicals Co.",
    "SMFR.CA": "Samad Misr EGYFERT.S.A.E",
    "SNFC.CA": "Sharkia National Company for Food Security",
    "SPHT.CA": "El Shams Pyramids Co. For Hotels & Touristic Projects S.A.E",
    "SPIN.CA": "Alexandria Spinning & Weaving Co.",
    "SPMD.CA": "Speed Medical Co",
    "SUCE.CA": "Suez Cement Company",
    "SUGR.CA": "Delta Sugar Company",
    "SVCE.CA": "South Valley Cement Company",
    "SWDY.CA": "El Sewedy Electric Company",
    "TALM.CA": "Taaleem Management Services Company S.A.E.",
    "TANM.CA": "Tanmiya For Real Estate Investment (S.A.E)",
    "TAQA.CA": "TAQA Arabia S.A.E.",
    "TMGH.CA": "Talaat Moustafa Group Holding",
    "TRTO.CA": "Trans Oceans Tours",
    "UBEE.CA": "The United Bank",
    "UEFM.CA": "Upper Egypt Mills Company J.S.C",
    "UEGC.CA": "El-Saeed Company for Contracting and Real Estate Investment \"SCCD\" (S.A.E.)",
    "UNIP.CA": "Universal For Paper and Packaging Materials",
    "UNIT.CA": "United Co. for Housing & Development - S.A.E.",
    "UTOP.CA": "Utopia Real Estate Investment and Tourism",
    "VALU.CA": "U Consumer Finance S.A.E.",
    "VERT.CA": "Vertika",
    "VLMR.CA": "Valmore Holding S.A.E.",
    "VLMRA.CA": "Valmore Holding S.A.E. - Preferred",
    "VODE.CA": "Vodafone Egypt",
    "WCDF.CA": "Middle & West Delta Flour Mills",
    "WKOL.CA": "Wadi Kom Ombo For Land Reclamation Co.",
    "XPRE.CA": "Xpress Integration",
    "ZEOT.CA": "Extracted Oil & Derivatives Co.",
    "ZMID.CA": "Zahraa El Maadi Investment and Development Company SAE",

    # --------- Indices ---------
    "^CASE30": "EGX30 Index",
    "^EGX70EWI.CA": "EGX70 EWI Index",
    "^EGX100EWI.CA": "EGX100 EWI Index",

    "USDEGP=X": "USD_EGP_Exchange_Rate",
    "CL=F": "WTI_Crude_CL",
}

# Updated every 15 minutes regardless of EGX market hours.
commodity_tickers = {
    "GC=F": "Gold_COMEX",
    "SI=F": "Silver_COMEX",
    "BZ=F": "Brent_Crude_BZ",
    "USDEGP=X": "USD_EGP_Exchange_Rate",
    "CL=F": "WTI_Crude_CL",
}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def sanitize_filename(name: str) -> str:
    """
    Convert a company name to a safe file name:
    - Replace spaces, slashes, commas, dots, parentheses, ampersands with underscores
    - Remove any other non-alphanumeric characters
    - Collapse multiple underscores
    """
    name = name.replace(" ", "_")
    name = name.replace("/", "_")
    name = name.replace("\\", "_")
    name = name.replace(",", "_")
    name = name.replace(".", "_")
    name = name.replace("(", "_")
    name = name.replace(")", "_")
    name = name.replace("&", "_and_")
    name = re.sub(r"[^A-Za-z0-9_]", "", name)
    name = re.sub(r"_+", "_", name)
    return name.strip("_")


def build_stock_registry(tickers_dict):
    return [
        {
            "ticker": ticker,
            "code": ticker.split(".")[0] if "." in ticker else ticker.replace("^", ""),
            "name": company_name,
            "fileName": sanitize_filename(company_name),
        }
        for ticker, company_name in tickers_dict.items()
    ]


def save_stock_registry(registry):
    with open(EGX_STOCKS_JSON, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


def get_download_date_range():
    """
    Return a 2-year window ending today (inclusive).
    """
    now = datetime.now()
    start_date = (now - relativedelta(years=2)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")
    return start_date, end_date


# ─── Twelve Data API Functions ───────────────────────────────────────────────

def fetch_time_series_batch(symbols, start_date, end_date, interval="1day"):
    """
    Fetch time series data for a batch of symbols from Twelve Data.
    Returns a dict mapping symbol -> list of OHLCV records.
    """
    if not TWELVE_DATA_API_KEY:
        raise ValueError("TWELVE_DATA_API_KEY environment variable is not set")

    symbols_str = ",".join(symbols)
    url = f"{TWELVE_DATA_BASE_URL}/time_series"
    params = {
        "symbol": symbols_str,
        "interval": interval,
        "start_date": start_date,
        "end_date": end_date,
        "apikey": TWELVE_DATA_API_KEY,
        "format": "JSON",
        "outputsize": 5000,
        "order": "asc",
    }

    try:
        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        data = response.json()

        # Handle error response at top level
        if "status" in data and data["status"] == "error":
            print(f"    ✗ API Error: {data.get('message', 'Unknown error')}")
            return {}

        # Batch response: dict with symbol keys
        result = {}
        for symbol in symbols:
            symbol_data = data.get(symbol)
            if symbol_data is None:
                # Try with/without exchange suffix
                alt_symbol = symbol.replace(".CA", "")
                symbol_data = data.get(alt_symbol)

            if isinstance(symbol_data, dict) and "values" in symbol_data:
                result[symbol] = symbol_data["values"]
            elif isinstance(symbol_data, list):
                result[symbol] = symbol_data
            else:
                # Symbol not found or error for this symbol
                error_msg = symbol_data.get("message", "No data") if isinstance(symbol_data, dict) else "No data"
                print(f"    ⚠ No data for {symbol}: {error_msg}")

        return result

    except requests.exceptions.RequestException as e:
        print(f"    ✗ Network error: {e}")
        return {}
    except Exception as e:
        print(f"    ✗ Unexpected error: {e}")
        return {}


def convert_to_dataframe(records, symbol, company_name):
    """
    Convert Twelve Data time series records to a DataFrame matching
    the original yFinance output structure:
    Date, Open, High, Low, Close, Volume
    """
    if not records:
        return None

    df = pd.DataFrame(records)

    # Twelve Data columns: datetime, open, high, low, close, volume
    # Rename to match original structure
    column_map = {
        "datetime": "Date",
        "open": "Open",
        "high": "High",
        "low": "Low",
        "close": "Close",
        "volume": "Volume",
    }
    df = df.rename(columns=column_map)

    # Ensure all expected columns exist
    expected_cols = ["Date", "Open", "High", "Low", "Close", "Volume"]
    for col in expected_cols:
        if col not in df.columns:
            df[col] = None

    # Reorder columns to match original
    df = df[expected_cols]

    # Convert numeric columns
    numeric_cols = ["Open", "High", "Low", "Close", "Volume"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # Format Date as plain string (no timezone)
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")

    return df


# ─── Main Download Logic ─────────────────────────────────────────────────────

def download_tickers(tickers, label=""):
    start_date, end_date = get_download_date_range()
    output_dir = os.path.abspath(STOCK_DATA_OUTPUT_DIR)
    os.makedirs(output_dir, exist_ok=True)

    prefix = f"{label} " if label else ""
    run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{prefix}Run started at {run_time}")
    print(f"{prefix}Fetching data from {start_date} through {end_date} via Twelve Data...")
    print("-" * 60)

    success_count = 0
    failed_symbols = []

    # Split tickers into batches of BATCH_SIZE
    ticker_items = list(tickers.items())
    total_batches = (len(ticker_items) + BATCH_SIZE - 1) // BATCH_SIZE

    for batch_idx in range(total_batches):
        batch_start = batch_idx * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, len(ticker_items))
        batch = ticker_items[batch_start:batch_end]
        batch_symbols = [ticker for ticker, _ in batch]
        batch_tickers = dict(batch)

        print(f"  Batch {batch_idx + 1}/{total_batches}: {len(batch_symbols)} symbols")

        # Fetch batch data
        batch_data = fetch_time_series_batch(batch_symbols, start_date, end_date)

        # Process each symbol in the batch
        for symbol, company_name in batch:
            try:
                records = batch_data.get(symbol)
                if not records:
                    print(f"    ⚠ No data returned for {symbol} ({company_name}) — skipping")
                    failed_symbols.append(symbol)
                    continue

                df = convert_to_dataframe(records, symbol, company_name)
                if df is None or df.empty:
                    print(f"    ⚠ Empty data for {symbol} ({company_name}) — skipping")
                    failed_symbols.append(symbol)
                    continue

                safe_name = sanitize_filename(company_name)
                file_path = os.path.join(output_dir, f"{safe_name}.csv")
                df.to_csv(file_path, index=False)
                success_count += 1
                print(f"    ✓ Saved {len(df)} rows → {safe_name}.csv  (last date: {df['Date'].iloc[-1]})")

            except Exception as e:
                print(f"    ✗ Error processing {symbol}: {e}")
                failed_symbols.append(symbol)
                continue

        # Rate limit delay between batches (except after last batch)
        if batch_idx < total_batches - 1:
            print(f"  ⏳ Rate limit: sleeping {RATE_LIMIT_DELAY}s before next batch...")
            time.sleep(RATE_LIMIT_DELAY)

    print("-" * 60)
    print(f"{prefix}Done! Saved {success_count}/{len(tickers)} files to '{output_dir}/'.")

    if failed_symbols:
        print(f"  Failed symbols ({len(failed_symbols)}): {', '.join(failed_symbols[:10])}{'...' if len(failed_symbols) > 10 else ''}")

    return success_count


def download_egx_stocks():
    """Download EGX stocks, indices, FX, and WTI — run only during market hours."""
    success_count = download_tickers(egx_tickers, label="EGX")
    registry = build_stock_registry({**egx_tickers, **commodity_tickers})
    save_stock_registry(registry)
    print(f"Saved stock registry → {EGX_STOCKS_JSON}")
    return success_count


def download_commodities():
    """Download gold, silver, and Brent crude — runs 24/7 on a 15-minute schedule."""
    return download_tickers(commodity_tickers, label="Commodities")


def download_all_egx_separated():
    download_egx_stocks()
    download_commodities()


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if not TWELVE_DATA_API_KEY:
        print("ERROR: TWELVE_DATA_API_KEY environment variable is not set.")
        print("Get your free API key at: https://twelvedata.com")
        print("Then run: export TWELVE_DATA_API_KEY='your_key_here'")
        exit(1)

    download_egx_stocks()
