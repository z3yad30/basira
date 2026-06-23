import os
import re
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import yfinance as yf
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EGX_STOCKS_JSON = os.path.join(BASE_DIR, "egx_stocks.json")
STOCK_DATA_OUTPUT_DIR = os.path.join(BASE_DIR, "..", "stock_data", "stock_data")


def sanitize_filename(name: str) -> str:
    """
    Convert a company name to a safe file name:
    - Replace spaces, slashes, commas, dots, parentheses, ampersands with underscores
    - Remove any other non-alphanumeric characters
    - Collapse multiple underscores
    """
    name = name.replace(' ', '_')
    name = name.replace('/', '_')
    name = name.replace('\\', '_')
    name = name.replace(',', '_')
    name = name.replace('.', '_')
    name = name.replace('(', '_')
    name = name.replace(')', '_')
    name = name.replace('&', '_and_')
    name = re.sub(r'[^A-Za-z0-9_]', '', name)
    name = re.sub(r'_+', '_', name)
    return name.strip('_')


def build_stock_registry(egx_tickers):
    return [
        {
            "ticker": ticker,
            "code": ticker.split(".")[0],
            "name": company_name,
            "fileName": sanitize_filename(company_name),
        }
        for ticker, company_name in egx_tickers.items()
    ]


def save_stock_registry(registry):
    import json
    with open(EGX_STOCKS_JSON, "w", encoding="utf-8") as f:
        json.dump(registry, f, ensure_ascii=False, indent=2)


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

    "GC=F": "Gold_COMEX",
    "SI=F": "Silver_COMEX",
    "BZ=F": "Brent_Crude_BZ",
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


def get_download_date_range():
    """
    Return a 2-year window ending today (inclusive).

    - start : exactly 2 years before today
    - end   : tomorrow's date so yfinance's exclusive upper-bound includes today's
              completed session (or today's partial data if the market is still open).
    Both dates are recalculated every time this function is called, so every run
    automatically pulls up to the most-recent available data.
    """
    now = datetime.now()
    start_date = (now - relativedelta(years=2)).strftime("%Y-%m-%d")
    # yfinance end is exclusive → set it to tomorrow to capture today
    end_date = (now + timedelta(days=1)).strftime("%Y-%m-%d")
    return start_date, end_date


def download_tickers(tickers, label=""):
    start_date, end_date = get_download_date_range()
    output_dir = os.path.abspath(STOCK_DATA_OUTPUT_DIR)
    os.makedirs(output_dir, exist_ok=True)

    prefix = f"{label} " if label else ""
    run_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"{prefix}Run started at {run_time}")
    print(f"{prefix}Fetching data from {start_date} through today (end={end_date}, exclusive)...")
    print("-" * 60)

    success_count = 0
    for ticker, company_name in tickers.items():
        try:
            print(f"  Fetching: {ticker} ({company_name})")
            df = yf.download(
                ticker,
                start=start_date,
                end=end_date,
                progress=False,
                auto_adjust=True,   # applies splits/dividends, removes 'Adj Close' col
                actions=False,      # skip dividends/splits columns in output
            )

            if df is not None and not df.empty:
                # Flatten MultiIndex columns produced by yfinance ≥ 0.2
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)

                df = df.reset_index()

                # Ensure the Date column is a plain date string (no timezone suffix)
                if "Date" in df.columns:
                    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")

                safe_name = sanitize_filename(company_name)
                file_path = os.path.join(output_dir, f"{safe_name}.csv")
                df.to_csv(file_path, index=False)
                success_count += 1
                print(f"    ✓ Saved {len(df)} rows → {safe_name}.csv  (last date: {df['Date'].iloc[-1]})")
            else:
                print(f"    ⚠ No data returned for {ticker} ({company_name}) — skipping")

        except Exception as e:
            print(f"    ✗ Error downloading {ticker}: {e}")
            continue

    print("-" * 60)
    print(f"{prefix}Done! Saved {success_count}/{len(tickers)} files to '{output_dir}/'.")
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


if __name__ == "__main__":
    download_egx_stocks()
