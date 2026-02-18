-- Improve artefact image accuracy: prefer object-specific photos,
-- and clear unresolved misleading images.

UPDATE venues
SET image_url = CASE slug
  WHEN 'coca-cola-vault' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Vault_of_the_Secret_Formula_at_the_World_of_Coca-Cola.jpg/960px-Vault_of_the_Secret_Formula_at_the_World_of_Coca-Cola.jpg'
  WHEN 'noguchi-playscape' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNF8kHtMOtuX_cr3lWMynhgnMAzX0W1zBAlqQj6EWdh6x5A_Ba21zIYTQY4s7NjEpZxz-ql5NYM1PGYl2u76kngLX_3GryQtfBI7ALTX0X4K0w38AWgpaLdjLuS72FWne4u_zaBtVNAmuTERVg=s4800-w1200'
  WHEN 'lord-dooley-statue' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNEuGIqt_dJ_-YKSayNHv32PzjtcfHaf4d2EI6dcw_PzuB1LnBKcLUYPWFiprIIUrdEF5wbMmY_ADswhHDeMfkXrppy5NTmRUm3HrEu3_mmuJsi5nbFbW2aEPMbhKViCZ-FClDsiyiU7Rq7X1g=s4800-w1200'
  WHEN 'anti-gravity-monument' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNH2PduqOCtod9xkTini7Pk9SI9C0ZhihxMeOCWttrfnuTR8YmdnW2FTHBhwtp0qVjxdn2PuuORT_mRWm6beZLh-KHR6_NMDRcXBfYwETp9NohfWB4_Y3l_qQ3q6XfBl-qzvJyksbG9eyCktHBs=s4800-w1200'
  WHEN 'hank-aaron-home-run-wall' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNHkzTAacWkimQnvjJK3VBZSaZAeeNtKdJN8vQnbXWKiefGtFMgO6PudtXlgfDO_jOMv24W7pt7uW0gs239jIGnsy-XOKLN7J5cY6ef8YzpKTZj2Gx1wKKoydF3qOQ8e0r-xGfC2j5F5wnUOBQ=s4800-w1200'
  WHEN 'pink-trap-house-chevy' THEN 'https://lh3.googleusercontent.com/places/ANXAkqFB0xfEHhmG5Pe3vNRbNJK-qIXwkLxjsneYx4fblnQ6IelgKWFC-sfDN73di-mznu3-96sh19CV9cWsuMmkLQHWjXjFpZdWD8k=s4800-w1200'
  WHEN 'riverview-carousel' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Riverview_Carousel%2C_Six_Flags_Over_Georgia_1.jpg/960px-Riverview_Carousel%2C_Six_Flags_Over_Georgia_1.jpg'
  WHEN 'spirit-of-delta' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNFXHKNL3vGbVNq7eEx-f4kf3nQD-Pg4eWUAGYezxY3wX0AMR-Qfsm2gzirikrQO96iYFwqKkzvn3UWIxPDE_X6GO4WInFcZZLk_WB4c3hYGpo_qhca0eeESsvXmW5zPtfsgFMdLM5HL5BaRyuA=s4800-w1200'
  WHEN 'lion-of-atlanta' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Andrew_Kuchling_-_Lion_of_Atlanta_monument.jpg/960px-Andrew_Kuchling_-_Lion_of_Atlanta_monument.jpg'
  WHEN 'asa-candler-mausoleum' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNGl_fnI3H7OBYxUTncB5f7ssSoLB940J9QO2hTI0GMiL0bQa2IBO1lLaIBFOvsrafXds57Gyh4BgWrwUR-23i0x95VJCswftM0FzxDBMjfetOMDCxl8QN2WVNxG0gX219QUAM7OM0XzcQLG-g=s4800-w1200'
  WHEN 'fdr-superb-railcar' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNGW62ZoZ-AHQDkcGmjzgdES8hjSJC1MxrvgXF9toaLOzUALnNA63-TadaQCkN5H-c8hi5ETfT_bUhtmYwhtqjbH-a1Or5_fy8jklklupLBPJNoa2ZPK9vwyVCJOmxJQqJy2XKraKlRWGDr2zA=s4800-w1200'
  WHEN 'merci-boxcar' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Merci_Boxcar%2C_Georgia_1.jpg/960px-Merci_Boxcar%2C_Georgia_1.jpg'
  WHEN 'bobby-jones-grave' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Grave_of_Robert_%28Bobby%29_Jones_and_Mary_Jones_at_Oakland_Cemetery_in_Atlanta%2C_August_2016.jpg/960px-Grave_of_Robert_%28Bobby%29_Jones_and_Mary_Jones_at_Oakland_Cemetery_in_Atlanta%2C_August_2016.jpg'
  WHEN 'kermit-chaplin-statue' THEN NULL
  WHEN 'one-person-jail-cell' THEN NULL
  WHEN 'adalanta-desert-plaque' THEN NULL
  WHEN 'hank-aaron-statue' THEN NULL
  WHEN '1895-exposition-steps' THEN NULL
  WHEN 'fiddlin-john-carsons-grave' THEN NULL
  ELSE image_url
END
WHERE slug IN (
  'coca-cola-vault',
  'noguchi-playscape',
  'lord-dooley-statue',
  'anti-gravity-monument',
  'hank-aaron-home-run-wall',
  'pink-trap-house-chevy',
  'riverview-carousel',
  'spirit-of-delta',
  'lion-of-atlanta',
  'asa-candler-mausoleum',
  'fdr-superb-railcar',
  'merci-boxcar',
  'bobby-jones-grave',
  'kermit-chaplin-statue',
  'one-person-jail-cell',
  'adalanta-desert-plaque',
  'hank-aaron-statue',
  '1895-exposition-steps',
  'fiddlin-john-carsons-grave'
);
