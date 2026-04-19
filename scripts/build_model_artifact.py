import json
from pathlib import Path

import m2cgen as m2c
import pandas as pd
from lightgbm import LGBMClassifier, early_stopping
from sklearn.metrics import f1_score

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = Path('/Users/jao/Desktop/FDA Project/FDA Inspection Data.csv')
SITE_ASSETS = ROOT / 'site' / 'assets'

OUTCOME_MAP = {
    'No Action Indicated (NAI)': 0,
    'Voluntary Action Indicated (VAI)': 1,
    'Official Action Indicated (OAI)': 2,
}

PRODUCT_WARNING_RANK = {
    'Food/Cosmetics': 2,
    'Drugs': 3,
    'Devices': 4,
    'Biologics': 6,
    'Tobacco': 1,
    'Veterinary': 5,
}

PRODUCT_INJUNCTION_RANK = {
    'Food/Cosmetics': 1,
    'Drugs': 2,
    'Devices': 4,
    'Biologics': 5,
    'Tobacco': 6,
    'Veterinary': 3,
}

STATE_TO_REGION = {
    'Connecticut': 'Northeast', 'Maine': 'Northeast', 'Massachusetts': 'Northeast',
    'New Hampshire': 'Northeast', 'Rhode Island': 'Northeast', 'Vermont': 'Northeast',
    'New Jersey': 'Northeast', 'New York': 'Northeast', 'Pennsylvania': 'Northeast',
    'Illinois': 'Midwest', 'Indiana': 'Midwest', 'Michigan': 'Midwest', 'Ohio': 'Midwest',
    'Wisconsin': 'Midwest', 'Iowa': 'Midwest', 'Kansas': 'Midwest', 'Minnesota': 'Midwest',
    'Missouri': 'Midwest', 'Nebraska': 'Midwest', 'North Dakota': 'Midwest', 'South Dakota': 'Midwest',
    'Delaware': 'South', 'Florida': 'South', 'Georgia': 'South', 'Maryland': 'South',
    'North Carolina': 'South', 'South Carolina': 'South', 'Virginia': 'South',
    'District of Columbia': 'South', 'West Virginia': 'South', 'Alabama': 'South',
    'Kentucky': 'South', 'Mississippi': 'South', 'Tennessee': 'South', 'Arkansas': 'South',
    'Louisiana': 'South', 'Oklahoma': 'South', 'Texas': 'South',
    'Arizona': 'West', 'Colorado': 'West', 'Idaho': 'West', 'Montana': 'West',
    'Nevada': 'West', 'New Mexico': 'West', 'Utah': 'West', 'Wyoming': 'West',
    'Alaska': 'West', 'California': 'West', 'Hawaii': 'West', 'Oregon': 'West', 'Washington': 'West',
    'Puerto Rico': 'Territory', 'Virgin Islands': 'Territory', 'Guam': 'Territory',
    'Northern Mariana Islands': 'Territory', 'American Samoa': 'Territory', '-': 'Unknown'
}

COUNTRY_TO_REGION = {
    'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
    'Costa Rica': 'North America', 'Panama': 'North America', 'Guatemala': 'North America',
    'Brazil': 'South America', 'Argentina': 'South America', 'Chile': 'South America',
    'Peru': 'South America', 'Colombia': 'South America',
    'United Kingdom': 'Europe', 'Ireland': 'Europe', 'Germany': 'Europe', 'France': 'Europe',
    'Netherlands': 'Europe', 'Italy': 'Europe', 'Spain': 'Europe', 'Switzerland': 'Europe',
    'Denmark': 'Europe', 'Sweden': 'Europe', 'Poland': 'Europe', 'Austria': 'Europe',
    'Belgium': 'Europe', 'Portugal': 'Europe',
    'China': 'Asia', 'India': 'Asia', 'Japan': 'Asia', 'Singapore': 'Asia',
    'Korea (the Republic of)': 'Asia', 'Taiwan': 'Asia', 'Malaysia': 'Asia',
    'Thailand': 'Asia', 'Vietnam': 'Asia', 'Indonesia': 'Asia',
    'United Arab Emirates': 'Asia', 'Saudi Arabia': 'Asia', 'Israel': 'Asia',
    'South Africa': 'Africa', 'Egypt': 'Africa', 'Morocco': 'Africa', 'Tunisia': 'Africa',
    'Nigeria': 'Africa', 'Kenya': 'Africa',
    'Australia': 'Oceania', 'New Zealand': 'Oceania'
}

FEATURES = [
    'State', 'Zip', 'Country_Area', 'Fiscal_Year', 'Project_Area', 'Product_Type',
    'Presidential_Administration', 'President_Party', 'Years_Since_Admin_Start',
    'Product_Type_Warning_Letter_Frequency', 'Product_Type_Injunction_Frequency',
    'Region', 'US_Region', 'Past_Inspections', 'Past_NAI', 'Past_VAI', 'Past_OAI'
]

CAT_FEATURES = [
    'State', 'Country_Area', 'Project_Area', 'Product_Type',
    'Presidential_Administration', 'Region', 'US_Region'
]

BEST_PARAMS_FROM_NOTEBOOK = {
    'n_estimators': 661,
    'learning_rate': 0.0061717228259232215,
    'num_leaves': 91,
    'max_depth': 4,
    'min_child_samples': 41,
    'subsample': 0.9515775849930027,
    'colsample_bytree': 0.9615873406517462,
    'reg_alpha': 1.0373667897370675,
    'reg_lambda': 2.09039438064509,
}


def map_administration(year: int) -> str:
    if 2009 <= year <= 2016:
        return 'Obama'
    if 2017 <= year <= 2020:
        return 'Trump'
    if 2021 <= year <= 2024:
        return 'Biden'
    if year >= 2025:
        return 'Trump'
    return 'Trump'


def years_since_admin_start(year: int) -> int:
    if 2009 <= year <= 2016:
        return year - 2009
    if 2017 <= year <= 2020:
        return year - 2017
    if 2021 <= year <= 2025:
        return year - 2021
    return 0


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out['Zip'] = pd.to_numeric(out['Zip'], errors='coerce').fillna(0)
    out['Inspection End Date'] = pd.to_datetime(out['Inspection End Date'], errors='coerce')
    out['Inspection Outcome'] = out['Classification'].map(OUTCOME_MAP).astype('Int64')
    out = out.dropna(subset=['Inspection Outcome'])
    out['Inspection Outcome'] = out['Inspection Outcome'].astype(int)

    out['Presidential Administration'] = out['Fiscal Year'].apply(map_administration)
    out['President Party'] = out['Presidential Administration'].map({'Obama': 1, 'Biden': 1, 'Trump': 0}).fillna(0)
    out['Years Since Admin Start'] = out['Fiscal Year'].apply(years_since_admin_start)
    out['Product Type Warning Letter Frequency'] = out['Product Type'].map(PRODUCT_WARNING_RANK).fillna(0)
    out['Product Type Injunction Frequency'] = out['Product Type'].map(PRODUCT_INJUNCTION_RANK).fillna(0)

    out['Region'] = out['Country/Area'].map(COUNTRY_TO_REGION).fillna('Unknown')
    out['US_Region'] = out['State'].map(STATE_TO_REGION).fillna('Unknown')

    # Leakage-safe historical features: freeze history at end of 2023 for future rows.
    hist = out.sort_values(['FEI Number', 'Fiscal Year', 'Inspection End Date']).copy()
    hist['Past Inspections'] = hist.groupby('FEI Number').cumcount()
    hist['Past NAI'] = hist.groupby('FEI Number')['Inspection Outcome'].transform(lambda x: x.eq(0).cumsum().shift(fill_value=0))
    hist['Past VAI'] = hist.groupby('FEI Number')['Inspection Outcome'].transform(lambda x: x.eq(1).cumsum().shift(fill_value=0))
    hist['Past OAI'] = hist.groupby('FEI Number')['Inspection Outcome'].transform(lambda x: x.eq(2).cumsum().shift(fill_value=0))

    hist_2023 = (
        hist.loc[hist['Fiscal Year'] <= 2023]
        .groupby('FEI Number')['Inspection Outcome']
        .agg(
            Past_Inspections_2023='count',
            Past_NAI_2023=lambda s: (s == 0).sum(),
            Past_VAI_2023=lambda s: (s == 1).sum(),
            Past_OAI_2023=lambda s: (s == 2).sum(),
        )
    )

    future_mask = hist['Fiscal Year'] > 2023
    hist.loc[future_mask, 'Past Inspections'] = hist.loc[future_mask, 'FEI Number'].map(hist_2023['Past_Inspections_2023']).fillna(0)
    hist.loc[future_mask, 'Past NAI'] = hist.loc[future_mask, 'FEI Number'].map(hist_2023['Past_NAI_2023']).fillna(0)
    hist.loc[future_mask, 'Past VAI'] = hist.loc[future_mask, 'FEI Number'].map(hist_2023['Past_VAI_2023']).fillna(0)
    hist.loc[future_mask, 'Past OAI'] = hist.loc[future_mask, 'FEI Number'].map(hist_2023['Past_OAI_2023']).fillna(0)

    out[['Past Inspections', 'Past NAI', 'Past VAI', 'Past OAI']] = (
        hist[['Past Inspections', 'Past NAI', 'Past VAI', 'Past OAI']]
        .reindex(out.index)
        .fillna(0)
        .astype(int)
    )

    model_df = pd.DataFrame({
        'State': out['State'].fillna('Unknown'),
        'Zip': out['Zip'].astype(float),
        'Country_Area': out['Country/Area'].fillna('Unknown'),
        'Fiscal_Year': out['Fiscal Year'].astype(int),
        'Project_Area': out['Project Area'].fillna('Unknown'),
        'Product_Type': out['Product Type'].fillna('Unknown'),
        'Presidential_Administration': out['Presidential Administration'].fillna('Unknown'),
        'President_Party': out['President Party'].astype(int),
        'Years_Since_Admin_Start': out['Years Since Admin Start'].astype(int),
        'Product_Type_Warning_Letter_Frequency': out['Product Type Warning Letter Frequency'].astype(float),
        'Product_Type_Injunction_Frequency': out['Product Type Injunction Frequency'].astype(float),
        'Region': out['Region'].fillna('Unknown'),
        'US_Region': out['US_Region'].fillna('Unknown'),
        'Past_Inspections': out['Past Inspections'].astype(int),
        'Past_NAI': out['Past NAI'].astype(int),
        'Past_VAI': out['Past VAI'].astype(int),
        'Past_OAI': out['Past OAI'].astype(int),
        'y': out['Inspection Outcome'].astype(int),
    })

    return model_df


def make_category_maps(train_df: pd.DataFrame):
    cat_maps = {}
    for col in CAT_FEATURES:
        categories = sorted(train_df[col].astype(str).fillna('Unknown').unique().tolist())
        if 'Unknown' not in categories:
            categories.append('Unknown')
        cat_maps[col] = {val: i for i, val in enumerate(categories)}
    return cat_maps


def apply_category_maps(df: pd.DataFrame, cat_maps: dict):
    out = df.copy()
    for col, mapping in cat_maps.items():
        out[col] = out[col].astype(str).map(mapping).fillna(mapping['Unknown']).astype(float)
    return out


def main():
    SITE_ASSETS.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(DATA_PATH)
    model_df = prepare_dataframe(raw)

    train_mask = model_df['Fiscal_Year'] <= 2023
    eval_mask = model_df['Fiscal_Year'] == 2024
    test_mask = model_df['Fiscal_Year'].isin([2025, 2026])

    train_df = model_df.loc[train_mask].copy()
    eval_df = model_df.loc[eval_mask].copy()
    test_df = model_df.loc[test_mask].copy()

    y_train = train_df.pop('y').astype(int)
    y_eval = eval_df.pop('y').astype(int)
    y_test = test_df.pop('y').astype(int)

    cat_maps = make_category_maps(train_df)
    X_train = apply_category_maps(train_df[FEATURES], cat_maps)
    X_eval = apply_category_maps(eval_df[FEATURES], cat_maps)
    X_test = apply_category_maps(test_df[FEATURES], cat_maps)

    best_params = {
        **BEST_PARAMS_FROM_NOTEBOOK,
        'objective': 'multiclass',
        'num_class': 3,
        'random_state': 42,
        'n_jobs': -1,
    }
    model = LGBMClassifier(**best_params)
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_eval, y_eval)],
        eval_metric='multi_logloss',
        callbacks=[early_stopping(30, verbose=False)],
    )

    pred_eval = model.predict(X_eval)
    pred_test = model.predict(X_test)
    eval_f1 = float(f1_score(y_eval, pred_eval, average='macro'))
    test_f1 = float(f1_score(y_test, pred_test, average='macro'))

    js_model = m2c.export_to_javascript(model)
    js_bundle = (
        '// Auto-generated from LightGBM via m2cgen.\n'
        + js_model
        + '\nwindow.__fdaModelScore = score;\n'
    )
    (SITE_ASSETS / 'model.js').write_text(js_bundle, encoding='utf-8')

    metadata = {
        'feature_order': FEATURES,
        'categorical_features': CAT_FEATURES,
        'category_maps': cat_maps,
        'label_names': ['NAI', 'VAI', 'OAI'],
        'best_params': best_params,
        'metrics': {
            'eval_macro_f1': eval_f1,
            'test_macro_f1': test_f1,
        },
        'state_to_region': STATE_TO_REGION,
        'country_to_region': COUNTRY_TO_REGION,
        'product_warning_rank': PRODUCT_WARNING_RANK,
        'product_injunction_rank': PRODUCT_INJUNCTION_RANK,
        'project_area_options': sorted(model_df['Project_Area'].astype(str).unique().tolist()),
        'product_type_options': sorted(model_df['Product_Type'].astype(str).unique().tolist()),
        'country_options': sorted(model_df['Country_Area'].astype(str).unique().tolist()),
        'state_options': sorted(model_df['State'].astype(str).unique().tolist()),
    }
    (SITE_ASSETS / 'metadata.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    print('Model artifact generated.')
    print('Using fixed macro-F1 params from notebook output.')
    print(f"Eval macro-F1 (replay): {eval_f1:.4f}")
    print(f"Test macro-F1 (replay): {test_f1:.4f}")


if __name__ == '__main__':
    main()
