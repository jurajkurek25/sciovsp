-- Tvrdý dátum konca pre JEDNORAZOVO zakúpené členstvo (3/6/12 mesiacov,
-- /ponuka), oddelene od existujúceho premium_expires_at (ten je len bonus
-- navyše k aktívnemu predplatnému — referral dni, gift karty — a nikdy
-- sám o sebe nespôsobuje odobratie is_premium). Tento stĺpec naopak JE
-- tvrdý limit: keď uplynie, server.js expireMemberships() vypne is_premium.
-- Zostáva NULL pre všetkých bežných (skutočných, recurring) predplatiteľov.
alter table users add column if not exists membership_expires_at timestamptz;
