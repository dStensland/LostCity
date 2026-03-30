-- Fix Georgia Aquarium misclassified as 'museum' — should be 'aquarium'
UPDATE places SET place_type = 'aquarium' WHERE id = 29 AND place_type = 'museum';
