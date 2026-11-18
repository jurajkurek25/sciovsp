-- Rich-text predajný obsah pre obchod (digitálne aj tlačené produkty),
-- rovnaký princíp ako courses.sales_content v dash-service (Quill editor):
-- existujúci "description" ostáva krátky plain-text popis pre kartu v
-- katalógu + meta description, "sales_content" je HTML (nadpisy, tučné,
-- zoznamy) zobrazené na predajnej stránke produktu. Sanitizuje sa pri
-- uložení v routes/shop.js (rovnaká sada povolených tagov ako kurzy).
alter table digital_products add column if not exists sales_content text;
alter table physical_products add column if not exists sales_content text;
