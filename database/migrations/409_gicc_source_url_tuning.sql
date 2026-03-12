-- Point the GICC source at the official event archive rather than the homepage.

update sources
set url = 'https://www.gicc.com/events/list/'
where slug = 'gicc';
