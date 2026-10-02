# Metodika pre landing page dizajn

> Zdroj: [2389-research/landing-page-design](https://github.com/2389-research/landing-page-design) (MIT licencia). Stiahnuté ako referenčný materiál namiesto formálnej inštalácie Claude Code pluginu (ten je dostupný len cez CLI `/plugin marketplace add`, nie v tomto web prostredí). Cieľ: pri tvorbe ďalších landing/ponukových stránok pre SP Tréner sa touto metodikou riadiť manuálne.

## Základný problém, ktorý táto metodika rieši

AI-generované landing pages sa zbiehajú k rovnakým vzorom:
- fialové gradienty všade
- fonty Inter/Roboto
- Lucide ikony
- generické "bento grid" layouty
- rovnaké animačné vzory

Cieľom je vynútiť **jedinečný dizajnový smer pre každý projekt** cez proces "Vibe Discovery".

## Pred akýmkoľvek kódom — dva paralelné procesy

**Vibe Discovery (estetika):**
1. Zodpovedať kontextové otázky o projekte (referencie z reálneho sveta, cieľová nálada, dve konkurenčné inšpirácie, ktoré sa majú zraziť dokopy, "wildcard" prvok, čo do vzoru nezapadá)
2. Syntetizovať jedinečný estetický smer
3. Napísať si "Vibe Spec" (krátky popis smeru)
4. Prejsť "Freshness Check" — over si, že to nevyzerá ako každá druhá AI stránka

**Copy Strategy (text/konverzia):**
1. Zistiť top 3 nákupné námietky cieľovky
2. Napísať headline podľa vzorca Hodnota + Hook
3. Prejsť "litmus test" (vie niekto z headlinu samotného povedať, čo predávaš?)
4. CTA ako pokračovanie príbehu z headlinu, nie generické "Get Started"
5. Napísať si "Copy Strategy Spec"

Žiadne skratky — štýl a texty sa nevymýšľajú za pochodu.

## Kľúčové princípy

**Rovnica konverzie:** `Miera nákupu = Túžba − (Námaha + Zmätok)`. Každé rozhodnutie o texte/dizajne má buď zvýšiť túžbu, alebo znížiť námahu/zmätok.

**Pravidlo 50 %:** polovicu úsilia dať do hero sekcie — je to prvý dojem, sociálny preview, hook. Zvyšok stránky z nej vychádza.

**Litmus test headlinu:** ak návštevník vidí LEN headline a nič iné, vie presne, čo predávaš? Ak nie, prepísať.

**CTA ako pokračovanie príbehu:** "Nájdi jedlo blízko teba", nie "Začať". "Začni navrhovať", nie "Vyžiadať demo".

### Anti-convergence pravidlá
1. Farby generovať čerstvo z referencie, nie z pamäti/šablóny
2. Rotácia fontov — nepoužívať rovnaký display font naprieč projektmi
3. Kolízia dvoch vplyvov (z Vibe Discovery) musí byť v dizajne viditeľná
4. Wildcard prvok je povinný — niečo, čo "nezapadá"
5. Pomenovať si vibe — nepomenovaný smer sa vždy zvrhne na generický

### Čoho sa vyvarovať
- **Fonty:** Inter, Roboto, Open Sans, Lato
- **Ikony:** Lucide (preexponované)
- **Farby:** fialové gradienty, "Stripe paleta", generický modro-fialový prechod

### Použiť namiesto toho
- **Fonty:** Newsreader, Playfair Display, Clash Display, Outfit, Manrope, Satoshi
- **Ikony:** Iconify Solar, Heroicons, Phosphor
- **Farby:** odvodené z reálnej referencie z Q1 Vibe Discovery

### Poradie sekcií
1. Hero (hlavné zameranie)
2. Features/Benefits
3. Social Proof
4. Ako to funguje
5. Pricing (ak relevantné)
6. Finálne CTA
7. Footer

### Animačný slovník
- **Entrance:** fade-in, blur-in, slide-in, scale-in, stagger
- **Continuous:** marquee, beam, pulse, float, rotate
- **Interactive:** hover-lift, hover-glow, hover-reveal, click-ripple
- **Decorative:** grid lines, krivky/"noodles", gradientové "orbs", grain textúra

## Fázy implementácie
1. Research & Collect — referencie, výber fontov/ikon/farieb
2. Hero Development — postaviť a iterovať, kým nie je výrazné
3. Section Build-Out — sekcie pridávať postupne, jedna po druhej
4. Polish — responzivita, výkon, prístupnosť
5. Presentation — finálny screenshot/náhľad

## Kontrolné zoznamy pred dokončením

**Vizuálna odlišnosť:**
- [ ] žiadne generické fialové gradienty
- [ ] neštandardná sada ikon
- [ ] výrazné párovanie fontov
- [ ] aspoň jeden "zapamätateľný" prvok
- [ ] farebný systém cez CSS premenné

**Technické:**
- [ ] mobilná responzivita
- [ ] všetky obrázky sa načítavajú
- [ ] výkonné animácie
- [ ] prístupný kontrast
- [ ] rýchle počiatočné načítanie

**Konverzia:**
- [ ] headline prejde litmus testom
- [ ] hlavné CTA je naratívne pokračovanie (nie "Get Started")
- [ ] top 3 námietky sú na stránke adresované
- [ ] social proof je prítomný (alebo vedome vynechaný — nikdy nefalšovaný)
- [ ] copy pri jednotlivých funkciách sa viaže späť na hodnotu z hero
- [ ] logická hierarchia, žiadne zbytočné trenie pred akciou

---

## Poznámka k doterajším SP Tréner stránkam

`darek.html` a `ponuka.html` (obe v `main-app-patches/`) boli postavené v konzistentnom "SP Tréner" vizuálnom jazyku appky (tmavý motiv, `--volt`/`--purple` akcenty, Instrument Serif + DM Mono/Sans) — to je zámerne, lebo majú pôsobiť ako súčasť appky, nie ako samostatná marketingová kampaň. Ak budúca stránka (napr. registrácia na webinár) má pôsobiť ako **samostatná kampaň s vlastnou identitou** (nie ako súčasť appky), je to presne prípad, kde sa oplatí prejsť plným Vibe Discovery procesom vyššie namiesto recyklovania existujúcej farebnej schémy appky.
