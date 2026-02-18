-- Restore uncertain artefact images for manual review.
-- These are intentionally marked in the UI with a green question badge.

UPDATE venues
SET image_url = CASE slug
  WHEN 'kermit-chaplin-statue' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNFGKPWkzt8Ur-BgDyCNLwOaK3_HwUMQLdK4ypW5yz7sEUrYTwSKBw2jhWWTFkGO9S1ufvjKQhJjbYBNKTsDISiSewfJK7H2d1HGjViO6mWc921l8XUHIXv2nPImpArbSrNketN5FF5dvdCvfg=s4800-w1200'
  WHEN 'one-person-jail-cell' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNGTPaiognLiZ3kXUq8TRfsb8PCXuUUWZCDGJH-gGIBr1XDskcSw4Dwb_zOHldm9WoptE_K5bI8jb_rgOgbCAfi5v6SPQLBmiXvwI0DhjQeRrUvKYDtW9mVoMS8BL-vwi6MQN_WpIBh8h1L7=s4800-w1200'
  WHEN 'adalanta-desert-plaque' THEN 'https://lh3.googleusercontent.com/places/ANXAkqFRMWvfUYs7B1f0Heo7IqsjsJJInykE5pFKIPEKwA9Mwri7vxNqity6pj5f34_aVNhohWBaV6maujZVHv5gdGgwIvdf4YJm7mI=s4800-w1200'
  WHEN 'hank-aaron-statue' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNHkzTAacWkimQnvjJK3VBZSaZAeeNtKdJN8vQnbXWKiefGtFMgO6PudtXlgfDO_jOMv24W7pt7uW0gs239jIGnsy-XOKLN7J5cY6ef8YzpKTZj2Gx1wKKoydF3qOQ8e0r-xGfC2j5F5wnUOBQ=s4800-w1200'
  WHEN '1895-exposition-steps' THEN 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Cotton_States_and_International_Exposition_of_1895.png/889px-Cotton_States_and_International_Exposition_of_1895.png'
  WHEN 'fiddlin-john-carsons-grave' THEN 'https://lh3.googleusercontent.com/place-photos/AL8-SNFO5GJEUEIoPasb43ZeBtzhEhyCA0eY916v3CvDm8E38TJwKsJyudO-eq7TmxurcqyCB8s8i-jTu29HScV1rolnnsPVmTxLKg75lwXfqyU42CAaxmKIUlBlmBxWEI5Hmz0Fa775XL5Qw-E-zg=s4800-w1200'
  ELSE image_url
END
WHERE slug IN (
  'kermit-chaplin-statue',
  'one-person-jail-cell',
  'adalanta-desert-plaque',
  'hank-aaron-statue',
  '1895-exposition-steps',
  'fiddlin-john-carsons-grave'
);
