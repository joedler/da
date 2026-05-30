import csv
import json
from pathlib import Path


OUT = Path("outputs/admins.csv")
PRIVATE_INFO = Path("outputs/private_info.json")

# Default mock data for public repo / fallback
DEFAULT_ADMINS = [
    ["領隊A", "A車領隊", "001", "", "overview", "A車", ""],
    ["領隊B", "B車領隊", "002", "", "overview", "B車", ""],
    ["領隊C", "C車領隊", "003", "", "overview", "C車", ""],
    ["領隊D", "D車領隊", "004", "", "overview", "D車", ""],
    ["領隊E", "E車領隊", "005", "", "overview", "E車", ""],
    ["領隊F", "F車領隊", "006", "", "overview", "F車", ""],
    ["聯絡窗口", "旅行社窗口", "000", "", "overview_all", "", "可看全團"],
]


def load_admins() -> list[list[str]]:
    if PRIVATE_INFO.exists():
        try:
            with PRIVATE_INFO.open("r", encoding="utf-8") as f:
                data = json.load(f)
                bus_leaders = data.get("bus_leaders", [])
                agency_contact = data.get("agency_contact", None)

                admins = []
                for leader in bus_leaders:
                    # leader: ["類型", "姓名", "服務車次", "電話", "LINE或其他聯絡方式", "備註"]
                    phone = str(leader[3] or "")
                    phone_last3 = phone[-3:] if len(phone) >= 3 else ""
                    admins.append([
                        leader[1],
                        f"{leader[2]}領隊",
                        phone_last3,
                        leader[4],
                        "overview",
                        leader[2],
                        leader[5],
                    ])

                if agency_contact:
                    phone = str(agency_contact[3] or "")
                    phone_last3 = phone[-3:] if len(phone) >= 3 else ""
                    admins.append([
                        agency_contact[1],
                        agency_contact[0],
                        phone_last3,
                        agency_contact[4],
                        "overview_all",
                        agency_contact[2],
                        "可看全團" if agency_contact[1] == "聯絡窗口" else agency_contact[5],
                    ])

                if admins:
                    return admins
        except Exception:
            pass
    return DEFAULT_ADMINS


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["姓名", "角色", "手機末三碼", "LINE使用者ID", "權限", "服務車次", "備註"])
        writer.writerows(load_admins())
    print(OUT.resolve())


if __name__ == "__main__":
    main()

