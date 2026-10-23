-- Označuje nákupy, ktoré vznikli zadarmo vďaka aktívnemu predplatnému
-- (courses.access_mode = 'subscription'), nie skutočnou platbou ani úplne
-- voľne dostupným kurzom (access_mode = 'free'). Slúži na reporting a ako
-- základ pre prípadné budúce automatické odobratie prístupu pri zrušení
-- predplatného (zatiaľ sa prístup po udelení nezrušuje automaticky, pozri
-- poznámku v main-app-patches/75-subscription-course-access.js).
alter table course_purchases add column if not exists via_subscription_tier boolean not null default false;
