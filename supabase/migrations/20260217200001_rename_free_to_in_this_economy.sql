-- Rename "Best Free Thing to Do" → "In This Economy"
UPDATE best_of_categories
SET slug = 'in-this-economy',
    name = 'In This Economy',
    description = 'Where to go and not spend money'
WHERE slug = 'best-free-thing-to-do';
