from sources.usmnt import extract_usmnt_matches


def test_extract_usmnt_matches_from_next_payload():
    html = """
    <html><body>
      <script>
        self.__next_f.push([1,"1f:[\\"$\\",\\"div\\",null,{\\"children\\":[[\\"$\\",\\"$L21\\",null,{\\"matches\\":[{\\"description\\":\\"United States vs Belgium\\",\\"sponsor\\":\\"Presented by AT&T\\",\\"date\\":\\"2026-03-28T19:30:00.000Z\\",\\"venue\\":{\\"longName\\":\\"Mercedes-Benz Stadium\\",\\"location\\":\\"Atlanta, GA\\"},\\"contestants\\":[{\\"name\\":\\"United States\\",\\"position\\":\\"home\\"},{\\"name\\":\\"Belgium\\",\\"position\\":\\"away\\"}],\\"tickets\\":{\\"value\\":{\\"href\\":\\"https://www.ticketmaster.com/usmnt-vs-belgium\\"}},\\"matchFeedUrl\\":\\"/competitions/usmnt-friendlies-2026/matches/united-states-belgium\\"},{\\"description\\":\\"United States vs Portugal\\",\\"sponsor\\":\\"Presented by Bank of America\\",\\"date\\":\\"2026-03-31T23:00:00.000Z\\",\\"venue\\":{\\"longName\\":\\"Mercedes-Benz Stadium\\",\\"location\\":\\"Atlanta, GA\\"},\\"contestants\\":[{\\"name\\":\\"United States\\",\\"position\\":\\"home\\"},{\\"name\\":\\"Portugal\\",\\"position\\":\\"away\\"}],\\"tickets\\":{\\"value\\":{\\"href\\":\\"https://www.ticketmaster.com/usmnt-vs-portugal\\"}},\\"matchFeedUrl\\":\\"/competitions/usmnt-friendlies-2026/matches/united-states-portugal\\"}]}]]}]"])\n
      </script>
    </body></html>
    """

    matches = extract_usmnt_matches(html)

    assert len(matches) == 2
    assert matches[0]["description"] == "United States vs Belgium"
    assert matches[0]["venue"]["location"] == "Atlanta, GA"
    assert matches[0]["tickets"]["value"]["href"] == "https://www.ticketmaster.com/usmnt-vs-belgium"
    assert matches[1]["description"] == "United States vs Portugal"
