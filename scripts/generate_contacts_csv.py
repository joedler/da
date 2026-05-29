import csv
from pathlib import Path


OUT = Path("outputs/contacts.csv")

CONTACTS = [
    ["旅行社領隊", "領隊A", "A車", "0900000001", "", ""],
    ["旅行社領隊", "領隊B", "B車", "0900000002", "", ""],
    ["旅行社領隊", "領隊C", "C車", "0900000003", "", ""],
    ["旅行社領隊", "領隊D", "D車", "0900000004", "", ""],
    ["旅行社領隊", "領隊E", "E車", "0900000005", "", ""],
    ["旅行社領隊", "領隊F", "F車", "0900000006", "", ""],
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["類型", "姓名", "服務車次", "電話", "LINE或其他聯絡方式", "備註"])
        writer.writerows(CONTACTS)
    print(OUT.resolve())


if __name__ == "__main__":
    main()
