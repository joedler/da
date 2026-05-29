import csv
from pathlib import Path


OUT = Path("outputs/admins.csv")

ADMINS = [
    ["領隊A", "A車領隊", "279", "", "overview", "A車", ""],
    ["領隊B", "B車領隊", "666", "", "overview", "B車", ""],
    ["領隊C", "C車領隊", "580", "", "overview", "C車", ""],
    ["領隊D", "D車領隊", "224", "", "overview", "D車", ""],
    ["領隊E", "E車領隊", "091", "", "overview", "E車", ""],
    ["領隊F", "F車領隊", "005", "", "overview", "F車", ""],
    ["聯絡窗口", "旅行社窗口", "805", "", "overview_all", "", "可看全團"],
]


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["姓名", "角色", "手機末三碼", "LINE使用者ID", "權限", "服務車次", "備註"])
        writer.writerows(ADMINS)
    print(OUT.resolve())


if __name__ == "__main__":
    main()
