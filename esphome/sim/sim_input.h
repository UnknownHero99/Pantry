#pragma once
// Simulator only: barcodes written to sim/scan.fifo stand in for the
// scanner module. `sim/scan 3017620422003` writes one.

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#include <string>

namespace sim {

/** One scanned barcode, or "" when nothing is waiting. Never blocks. */
inline std::string read_scan() {
  static const char *path = "sim/scan.fifo";
  static int fd = -1;
  static std::string buf;
  if (fd < 0) {
    mkfifo(path, 0666);  // fails harmlessly if it already exists
    fd = open(path, O_RDONLY | O_NONBLOCK);
    if (fd < 0) return "";
  }
  char tmp[256];
  ssize_t n;
  while ((n = read(fd, tmp, sizeof tmp)) > 0) buf.append(tmp, n);
  size_t end = buf.find_first_of("\r\n");
  if (end == std::string::npos) return "";
  std::string code = buf.substr(0, end);
  buf.erase(0, end + 1);
  return code;
}

}  // namespace sim
