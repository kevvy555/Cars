# Cars — five-year ownership comparison

A static, responsive UK car ownership dashboard comparing the 61 road-car variants discussed in the Car Buying project.

## What it includes

- Sortable comparison table, with per-column text/category/numeric-range filters.
- Five-year total ownership and monthly equivalents, including depreciation, fuel, VED, insurance, servicing, tyres, repairs, MOT and transaction/preparation allowance.
- Search, quick filters, column visibility, individual vehicle details, and up to three-car comparison.
- Adjustable annual mileage (default 6,000), which recalculates fuel and ownership costs.
- CSV export of currently filtered rows.

## Run locally

Serve this folder with a static web server (e.g. `python -m http.server 8000`) and open `http://localhost:8000`. No build step or API key is required.

## Publish with GitHub Pages

In repository **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**. Save, then open the Pages URL GitHub displays. The repository can remain a static HTML/CSS/JavaScript site.

## Important assumptions

All money figures are **illustrative November 2026 UK estimates**, not personalised quotes, current dealer offers or guarantees of future resale values. The default is five years at 6,000 miles/year; running costs include a repairs reserve that is not necessarily spent. Power, weight and acceleration refer to representative versions; some model configurations vary. The unfinished personal restoration projects are not included as comparable road-ready replacement options.

A complete model for each listed car is in `data/cars.csv`; each row can be edited without modifying application logic. See the site for the current assumptions and limitations.
