from datetime import date

from sources.atlanta_model_train_show import parse_future_atlanta_shows


HTML = """
<html>
  <body>
    <table>
      <tr>
        <td>Atlanta, GA (Duluth)</td>
        <td>01/17/26</td>
        <td>Gas South Convention Center (Model Train &amp; Railroad Artifacts)<br>5200 Sugarloaf Parkway<br>Duluth, GA 30097</td>
      </tr>
      <tr>
        <td>DeLand, FL</td>
        <td>07/11/26</td>
        <td>Volusia County Fairgrounds (Model Train Show, some artifacts)</td>
      </tr>
      <tr>
        <td>Atlanta, GA (Duluth)</td>
        <td>08/22/26</td>
        <td>Gas South Conv. Center (Model Train &amp; Railroad Artifacts)<br>5200 Sugarloaf Parkway<br>Duluth, GA 30097</td>
      </tr>
    </table>
  </body>
</html>
"""


def test_parse_future_atlanta_shows_keeps_only_future_atlanta_rows() -> None:
    shows = parse_future_atlanta_shows(HTML, today=date(2026, 3, 11))

    assert shows == [
        {
            "date": "2026-08-22",
            "location": "Atlanta, GA (Duluth)",
            "facility": "Gas South Conv. Center (Model Train & Railroad Artifacts) 5200 Sugarloaf Parkway Duluth, GA 30097",
        }
    ]
