#pragma once
// State and text helpers for pantry-scanner.yaml's display.
// The YAML owns the LVGL widgets; this file keeps the data they show
// (last scan, put-away trip, offline queue, summary) and formats it,
// so the YAML lambdas stay short.

#include <algorithm>
#include <string>
#include <vector>
#include "lvgl.h"
#include "esphome/components/json/json_util.h"

namespace pantry {

// ── colours (match the v2 mockups) ───────────────────────────────────────

namespace col {
constexpr uint32_t BG = 0x0E1116, BG_IN = 0x0B1626;
constexpr uint32_t CARD = 0x171B22, CARD_IN = 0x13233A, SIDE_IN = 0x101D30;
constexpr uint32_t TEXT = 0xF1F3F7, MUTED = 0xA3ACBB, DIM = 0x8C95A5, FAINT = 0x5C6575;
constexpr uint32_t GREEN = 0x2FBF71, AMBER = 0xF0A43A, RED = 0xF05A6A, RED_TEXT = 0xFF8C99;
constexpr uint32_t BLUE = 0x1F6FD1, BLUE_TEXT = 0x6FB0FF;
}  // namespace col

// ── tiny LVGL helpers ────────────────────────────────────────────────────

inline void show(lv_obj_t *o, bool on) {
  if (on)
    lv_obj_remove_flag(o, LV_OBJ_FLAG_HIDDEN);
  else
    lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
}
inline void text(lv_obj_t *o, const std::string &s) { lv_label_set_text(o, s.c_str()); }
inline void fg(lv_obj_t *o, uint32_t c) { lv_obj_set_style_text_color(o, lv_color_hex(c), LV_PART_MAIN); }
inline void bg(lv_obj_t *o, uint32_t c) { lv_obj_set_style_bg_color(o, lv_color_hex(c), LV_PART_MAIN); }
inline void border(lv_obj_t *o, uint32_t c) { lv_obj_set_style_border_color(o, lv_color_hex(c), LV_PART_MAIN); }
inline void border_width(lv_obj_t *o, int w) { lv_obj_set_style_border_width(o, w, LV_PART_MAIN); }

// ── one scan reply (see scanReply in src/lib/server/inventory.js) ──────────

struct Reply {
  std::string status, mode, title, detail, meta, image, qr, code, location;
  std::string pkg, packed, use_by, left_text, older;
  int count = 0, prev = 0, units = 0, event_id = 0, list_count = 0, use_by_days = 0;
  bool has_use_by = false, last_one = false, on_list = false;
};

inline Reply last;

inline bool parse_reply(const std::string &body, Reply &r) {
  r = Reply{};
  return esphome::json::parse_json(body, [&r](JsonObject o) -> bool {
    r.status = o["status"] | "error";
    r.mode = o["mode"] | "";
    r.title = o["title"] | "";
    r.detail = o["detail"] | "";
    r.meta = o["meta"] | "";
    r.image = o["image"] | "";
    r.qr = o["qr"] | "";
    r.code = o["code"] | "";
    r.location = o["location"] | "";
    r.pkg = o["pkg"] | "";
    r.packed = o["packed"] | "";
    r.use_by = o["use_by"] | "";
    r.left_text = o["left_text"] | "";
    r.older = o["older"] | "";
    r.count = o["count"] | 0;
    r.prev = o["prev"] | r.count;
    r.units = o["units"] | 0;
    r.event_id = o["event_id"] | 0;
    r.list_count = o["list_count"] | 0;
    r.has_use_by = o["use_by_days"].is<int>();
    r.use_by_days = o["use_by_days"] | 0;
    r.last_one = o["last_one"] | false;
    r.on_list = o["on_list"] | false;
    return true;
  });
}

inline void error_reply(const std::string &title, const std::string &meta) {
  last = Reply{};
  last.status = "error";
  last.title = title;
  last.meta = meta;
}

// ── put-away trip: what this unpacking session added, newest first ─────────

struct TripRow {
  int event_id;
  std::string name;
  int units;
  std::string status;  // ok | unknown | lookup
};
inline std::vector<TripRow> trip;

inline void trip_put(const Reply &r) {
  if (r.event_id <= 0 || r.mode != "in") return;
  std::string name = r.status == "unknown" ? "New item" : r.status == "lookup" ? "Looking up…" : r.title;
  for (auto &t : trip) {
    if (t.event_id == r.event_id) {
      t.name = name;
      t.units = r.units;
      t.status = r.status;
      return;
    }
  }
  trip.insert(trip.begin(), TripRow{r.event_id, name, r.units, r.status});
}

inline void trip_drop(int event_id) {
  trip.erase(std::remove_if(trip.begin(), trip.end(), [=](const TripRow &t) { return t.event_id == event_id; }),
             trip.end());
}

inline int trip_items() {
  int n = 0;
  for (auto &t : trip) n += t.units;
  return n;
}

// ── offline queue: scans kept on the device until the server is back ────────

struct Queued {
  std::string code;
  bool in;
};
inline std::vector<Queued> queue;

inline void enqueue(const std::string &code, bool in) {
  if (queue.size() >= 50) queue.erase(queue.begin());
  queue.push_back({code, in});
}

// ── UNDO list: this scanner's recent scans (GET /api/scan/recent) ──────────

struct Recent {
  int event_id;
  std::string title, ago;
  bool in, unknown;
  int units;
};
inline std::vector<Recent> recent;

inline bool parse_recent(const std::string &body) {
  JsonDocument doc = esphome::json::parse_json(body);
  if (!doc.is<JsonArray>()) return false;
  recent.clear();
  for (JsonVariant v : doc.as<JsonArray>()) {
    std::string mode = v["mode"] | "out";
    recent.push_back(Recent{v["event_id"] | 0, v["title"] | "", v["ago"] | "", mode == "in", v["unknown"] | false,
                            v["units"] | 1});
  }
  return true;
}

// ── summary for the home tiles and the night screen ─────────────────────────

struct Soon {
  std::string name;
  int n, days;
};
struct Summary {
  int low_count = 0, expiring_count = 0, inbox_count = 0;
  std::vector<std::string> low;
  std::vector<Soon> soon;
};
inline Summary summary;

inline bool parse_summary(const std::string &body) {
  Summary s;
  bool ok = esphome::json::parse_json(body, [&s](JsonObject o) -> bool {
    s.low_count = o["low_count"] | 0;
    s.expiring_count = o["expiring_count"] | 0;
    s.inbox_count = o["inbox_count"] | 0;
    JsonArray low = o["low"], soon = o["soon"];
    for (JsonVariant v : low) s.low.push_back(v | "");
    for (JsonVariant v : soon)
      s.soon.push_back(Soon{v["name"] | "", v["n"] | 1, v["days"] | 0});
    return true;
  });
  if (ok) summary = s;
  return ok;
}

// ── formatting ─────────────────────────────────────────────────────────

inline bool is_package(const std::string &code) { return code.rfind("PNTRY:I:", 0) == 0 || code.rfind("pntry:i:", 0) == 0; }

/** "8 076809 513753" for an EAN-13, groups of four for anything else. */
inline std::string pretty_code(const std::string &code) {
  if (is_package(code)) return "Package #" + code.substr(8);
  if (code.size() == 13) return code.substr(0, 1) + " " + code.substr(1, 6) + " " + code.substr(7);
  std::string out;
  for (size_t i = 0; i < code.size(); i++) {
    if (i && i % 4 == 0) out += ' ';
    out += code[i];
  }
  return out;
}

/** Short enough for one row of the offline queue. */
inline std::string short_code(const std::string &code) {
  if (is_package(code)) return "Package #" + code.substr(8);
  if (code.size() > 8) return code.substr(0, 1) + " " + code.substr(1, 6) + " …";
  return code;
}

inline std::string join(const std::vector<std::string> &v, const char *sep, size_t max) {
  std::string out;
  for (size_t i = 0; i < v.size() && i < max; i++) {
    if (i) out += sep;
    out += v[i];
  }
  return out;
}

inline std::string days_text(int d) {
  if (d < 0) return "expired";
  if (d == 0) return "today";
  return std::to_string(d) + " d";
}

/** USE SOON tile body: "Beef mince ×2 · 6 d", soonest first, the urgent ones in amber. */
inline std::string soon_text(size_t max) {
  std::string out;
  for (size_t i = 0; i < summary.soon.size() && i < max; i++) {
    auto &s = summary.soon[i];
    if (i) out += "\n";
    out += s.name;
    if (s.n > 1) out += " ×" + std::to_string(s.n);
    out += s.days <= 7 ? " · #F0A43A " + days_text(s.days) + "#" : " · " + days_text(s.days);
  }
  return out;
}

inline std::string mmss(int s) {
  char buf[16];
  snprintf(buf, sizeof buf, "%d:%02d", s / 60, s % 60);
  return buf;
}

}  // namespace pantry
