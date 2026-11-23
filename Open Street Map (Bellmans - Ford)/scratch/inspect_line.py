with open("map.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i in range(8515, min(len(lines), 8540)):
    print(f"{i+1}: {lines[i]}", end="")
