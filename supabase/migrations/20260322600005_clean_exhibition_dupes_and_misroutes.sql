-- MIGRATION: Clean duplicate and misrouted exhibition records
--
-- Issues identified by data quality audit:
-- 1. Duplicate exhibitions: 47 extra records across 19 groups (Atlanta Contemporary 3x,
--    College Football HoF daily re-crawl, MODA tours as exhibitions, NCCHR monthly events)
-- 2. Single-day "exhibitions": 25 records where closing_date = opening_date (dance classes,
--    artist talks, car seat installations, conference sessions)
-- 3. MODA program misroutes: 19 records (LEGO Labs, Design Next, Hands On, Tantrum Thursday,
--    Exhibit Tours) — these are events, not exhibitions
-- 4. ASO concert misroutes: 4 "Pictures at an Exhibition" records — it's a Mussorgsky piece,
--    not an art exhibition
--
-- Total: 68 unique records to delete (categories overlap significantly)
-- Also: 1 Carlos Museum record with bogus 2029 closing date — nullified

-- Delete 68 duplicate/misrouted records
DELETE FROM exhibitions
WHERE id IN (
  '03e2fee1-8703-4e25-b17d-b442e0b40abb',
  '0400d16b-45b7-417e-b454-dad0072957d7',
  '0926c075-3a5f-4fbf-b23b-f6fe799bf707',
  '09fb8a37-6771-4d08-b832-a276f5af8e21',
  '0d4c408a-18f6-4dfe-80d1-82aea3ea5041',
  '158f7812-524b-41de-b24c-399cba12e25e',
  '1787a9aa-ae99-46f6-8838-a3c1a75ab132',
  '1b94047a-f610-4f2b-a543-99c8043f74de',
  '2292a9a6-b2b1-42ba-9437-6c5b7ceb5763',
  '238299d5-cc5e-42e2-a95b-b631c5fcb34a',
  '26a176f7-a1cc-4047-8398-db757334deb6',
  '2b2a83df-da5f-4da0-8fb2-5a940db3f2f3',
  '3041425f-9dc7-4f1a-852d-d0cba1758f36',
  '337f69af-9a1c-4e1e-9e36-91ac37869def',
  '35594a2c-49ba-41b6-a5bd-c310e6b86492',
  '3dc53bef-bec3-4503-913c-d6804152b371',
  '3fa3a010-8070-4871-9457-417c173758f7',
  '4a46dc0a-7035-4e3d-a727-4890c7796b89',
  '4f42e2d9-03a1-4038-ad4d-3054b5117dee',
  '4fb24f5a-4f97-4d8a-a1f6-7266090263be',
  '50115158-396b-45d3-a672-6970ed717443',
  '504d778d-35b5-4274-9bc9-567212b11775',
  '538cd05b-c0f0-4436-8bab-c418cd523e05',
  '5d9d7c8f-d924-40d3-8264-f7c15ec055b6',
  '5de837b3-49cb-4d18-8856-7bbcd2c67afa',
  '5eb15885-1279-4d6c-ab90-eb6ed8871812',
  '5fa416f3-b793-4919-b0e1-b79f10bc966a',
  '64021b02-30b0-406e-b70d-1526e8e8b94a',
  '6c64f5b5-c4db-4ac1-9b9b-deaa27fc3de4',
  '6e924387-53de-4add-976c-39f31f7ad3a1',
  '727ee4dc-82dc-492a-99b3-1e8b375382bf',
  '72a13dc8-a40e-4c7e-b281-826b76188f7d',
  '785254ca-e232-4e86-83c2-1d282bf03365',
  '785ef901-00d0-4985-8c1c-e3c0bb474468',
  '798fec2e-5ce3-4c76-a35e-bd2c4001f95a',
  '7d963da6-67e4-41db-90bf-8b5ffa0558f0',
  '7e97f0b3-a4ff-46f7-9542-ca828dd2f6b3',
  '7eba70df-bec1-4319-9816-e8a5c2692b88',
  '80e98597-1aa2-48f4-b09c-c81bed83a1ce',
  '82d414ce-4b59-49a2-ac99-f6b91131938b',
  '878ef6c7-4499-4ace-b4c1-c21bcc6e92e7',
  '89b78c74-d79e-4b7e-952f-4479105e4a72',
  '8a654d59-94bf-4ee8-a7d2-e10a7c13b10e',
  '8c9056e7-2212-4d58-9c27-ad3d21f32498',
  '8f6fdcf7-d67e-4fb1-8778-70ad9e0a7a0d',
  '9249d995-fce6-4057-8b75-f4ee4fdf4db8',
  '92ae9ccd-8e27-40de-b109-47e9c79e61d1',
  '93146188-a02a-4560-bc11-8e9005afaef8',
  '956919de-6692-4017-a79f-12e246f07ac8',
  '98471f55-f06d-4001-b62b-183182a9f98b',
  '9aaf8686-3015-44b4-bc19-854d66ab3419',
  'a0e84a2b-255a-4029-825b-2bb7dd46056c',
  'a170bb80-0f57-4619-9dc1-248c1a157567',
  'af83c6f3-1e1a-40fa-9b46-97ad644e22b0',
  'b3380f54-9dea-47ad-a1d7-fc915267430f',
  'b989cf91-cef5-448c-b283-2fc21e4778e4',
  'ba5a7cbd-4836-49d4-abd9-4ca78e1da9dd',
  'c5aa22f9-6276-4142-8a7a-3d467df7b4dd',
  'cb136ec4-004c-4cc9-b254-d3125db4265b',
  'd0047f81-6877-40d0-915c-10ab1962d43a',
  'd09fe2ab-2963-44c6-accf-b6ffe6954a07',
  'd3d61799-ac40-41b5-a25a-3c5047845809',
  'd5706e98-0c16-4a8b-8920-08a1bc669535',
  'e887446c-d953-47db-a4fb-dc47c1f3a274',
  'e9ba2afa-e7bc-4c7d-abd2-9c6e56c94101',
  'f43cc0cf-40f6-412d-99e8-3caae8df4766',
  'f69b38cb-d650-4de9-bb8e-f1827d0562a2',
  'fb40682e-99c5-472e-a1b5-a1648790b5cd'
);

-- Fix Carlos Museum bogus 2029 closing date
-- "One Broken Cup and Three Fanta Cans" — likely a year inference error
UPDATE exhibitions
SET closing_date = NULL
WHERE id = '5eb3735e-a01c-4f4a-acda-cc0359113817';
