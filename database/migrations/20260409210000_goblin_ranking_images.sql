-- Add images to Mission: Impossible ranking game items
-- Movies get TMDB posters, stunts/sequences get unique TMDB backdrops per film

-- Movies (posters)
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/l5uxY5m5OInWpcExIpKG6AR3rgL.jpg' WHERE name = 'Mission: Impossible' AND subtitle = '1996';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/hfnrual76gPeNFduhD4xzHWpfTw.jpg' WHERE name = 'Mission: Impossible 2' AND subtitle = '2000';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/vKGYCpmQyV9uHybWDzXuII8Los5.jpg' WHERE name = 'Mission: Impossible III' AND subtitle = '2006';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/eRZTGx7GsiKqPch96k27LK005ZL.jpg' WHERE name LIKE 'Mission: Impossible%Ghost Protocol' AND subtitle = '2011';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/fRJLXQBHK2wyznK5yZbO7vmsuVK.jpg' WHERE name LIKE 'Mission: Impossible%Rogue Nation' AND subtitle = '2015';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg' WHERE name LIKE 'Mission: Impossible%Fallout' AND subtitle = '2018';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/NNxYkU70HPurnNCSiCjYAmacwm.jpg' WHERE name LIKE 'Mission: Impossible%Dead Reckoning' AND subtitle = '2023';

-- MI (1996) stunts — unique backdrops
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/sra8XnL96OyLHENcglmZJg6HA8z.jpg' WHERE name = 'Langley ceiling hang' AND subtitle = 'MI';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/pbaAkR1FDvgndTVFgGRIzf9o49r.jpg' WHERE name = 'Aquarium restaurant explosion' AND subtitle = 'MI';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/eDtsTxALld2gPw9lO1hQIJXqMHu.jpg' WHERE name = 'Channel Tunnel helicopter chase' AND subtitle = 'MI';

-- MI (1996) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/jnR697dbIYn0erHOQdSFNhHhb1i.jpg' WHERE name = 'NOC list theft (embassy)' AND subtitle = 'MI';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/z0Hz9LIcAm8yhodffZhXuc0wK1M.jpg' WHERE name = 'Bible reveal / mole hunt' AND subtitle = 'MI';

-- MI:2 (2000) stunts
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/24DZfupDlhXeTchmcOkoGRhP5Vg.jpg' WHERE name = 'Rock climbing free solo' AND subtitle = 'MI:2';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/u819Obji086jtXzPfEDZbG1GEBt.jpg' WHERE name = 'Motorcycle joust' AND subtitle = 'MI:2';

-- MI:2 (2000) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/5vccIwvGcw1loUM3Ui1y7WZfMvM.jpg' WHERE name = 'Seville nightclub infiltration' AND subtitle = 'MI:2';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/tfFrcjcs3hSjDE59iGG3TDnO0qg.jpg' WHERE name = 'Chimera lab break-in' AND subtitle = 'MI:2';

-- MI:III (2006) stunts
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/bYKeB9uUcPmvikjouEEQ86uvPw9.jpg' WHERE name = 'Vatican infiltration' AND subtitle = 'MI:III';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/5hizq0BiBHPAV9iD2qbp5RwStdT.jpg' WHERE name = 'Shanghai factory swing' AND subtitle = 'MI:III';

-- MI:III (2006) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/sjcPWJ5TXgFglsoixNxyZRyEUq3.jpg' WHERE name = 'Bridge ambush / Davian capture' AND subtitle = 'MI:III';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/mOyF7rHVLF6uLbyb18FWTmcrjJe.jpg' WHERE name = 'Shanghai rooftop run' AND subtitle = 'MI:III';

-- Ghost Protocol (2011) stunts
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/ih4lZkUpmSE7AP3maymiO72xJ1z.jpg' WHERE name = 'Burj Khalifa climb' AND subtitle = 'Ghost Protocol';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/hqyjzDRCs1N5gEsh2gklzPdsEFD.jpg' WHERE name = 'Mumbai parking garage chase' AND subtitle = 'Ghost Protocol';

-- Ghost Protocol (2011) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/dP1LWMVH1KlEeIX3e6SPiioA6Ah.jpg' WHERE name = 'Kremlin infiltration' AND subtitle = 'Ghost Protocol';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/8nBx9T56GzARmHqAZ7yPfZ3X3oW.jpg' WHERE name = 'Sandstorm pursuit' AND subtitle = 'Ghost Protocol';

-- Rogue Nation (2015) stunts
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/vYIUN5rrCncHFY8WvcuXQlM4hk5.jpg' WHERE name = 'Plane door hang (takeoff)' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/ki5RnA0xNOEd3R0RohXqJt9R6Om.jpg' WHERE name = 'Morocco motorcycle chase' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/39gQ0wzN2N2VPLgwpzr3ebbh0jl.jpg' WHERE name = 'Underwater Torus breach' AND subtitle = 'Rogue Nation';

-- Rogue Nation (2015) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/2mUpYunvmXQni74Lydj2kKP2M10.jpg' WHERE name = 'Vienna opera house' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/eR20N1flPCQyp9HzpxlTcxgDAO7.jpg' WHERE name = 'London pursuit / glass box' AND subtitle = 'Rogue Nation';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/2ViN4APBD0M8T3PHUVpdAupNU84.jpg' WHERE name = 'Lane interrogation (The Syndicate reveal)' AND subtitle = 'Rogue Nation';

-- Fallout (2018) stunts
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/5jnoAA74Qwb5w6B9FMvnc20n6Ie.jpg' WHERE name = 'HALO jump' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/3IzR3VhZAyhxVnuRRUHFLkfK4hT.jpg' WHERE name = 'Helicopter canyon chase' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/beMWAyK6qc67KtnKnOFo3cq9juC.jpg' WHERE name = 'Paris motorcycle chase' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/nv3iKVxsRiQDO8IGo5H7mhvgg6r.jpg' WHERE name = 'Kashmir cliff fight' AND subtitle = 'Fallout';

-- Fallout (2018) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/AeP1o1KeOufEVePgTPgBO7xncSZ.jpg' WHERE name = 'Belfast bathroom fight' AND subtitle = 'Fallout';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/aw4FOsWr2FY373nKSxbpNi3fz4F.jpg' WHERE name = 'Kashmir nuclear deactivation' AND subtitle = 'Fallout';

-- Dead Reckoning (2023) stunts
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/628Dep6AxEtDxjZoGP78TsOxYbK.jpg' WHERE name = 'Motorcycle cliff jump' AND subtitle = 'Dead Reckoning';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/TFTfzrkX8L7bAKUcch6qLmjpLu.jpg' WHERE name = 'Orient Express train roof fight' AND subtitle = 'Dead Reckoning';

-- Dead Reckoning (2023) sequences
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/7D15YH9zk4vR9FFoUeVkFJiVDlu.jpg' WHERE name = 'Airport runway standoff' AND subtitle = 'Dead Reckoning';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/bYJv39whWTAOWO0mv7oUija8GgM.jpg' WHERE name = 'Venice chase' AND subtitle = 'Dead Reckoning';
UPDATE goblin_ranking_items SET image_url = 'https://image.tmdb.org/t/p/w500/bNt3SgeLfsMYvgOoYm82uhQOC4r.jpg' WHERE name = 'Rome car chase (Fiat)' AND subtitle = 'Dead Reckoning';
