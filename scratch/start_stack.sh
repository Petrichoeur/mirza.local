#!/bin/bash
# Mirza Monitoring Stack Startup Script
# Optimized for headless macOS environment

BREW_PREFIX="/opt/homebrew"
GRAFANA_INI="$BREW_PREFIX/etc/grafana/grafana.ini"
PROM_YML="$BREW_PREFIX/etc/prometheus.yml"
LOG_FILE="/tmp/mirza-monitoring.log"

echo "------------------------------------------" >> "$LOG_FILE"
echo "$(date) - Starting Mirza Monitoring Stack..." >> "$LOG_FILE"

# 1. Node Exporter
if ! pgrep -x "node_exporter" >/dev/null; then
    echo "Starting node_exporter..." >> "$LOG_FILE"
    nohup "$BREW_PREFIX/bin/node_exporter" >> "$LOG_FILE" 2>&1 &
else
    echo "node_exporter is already running." >> "$LOG_FILE"
fi

# 2. Prometheus
if ! pgrep -x "prometheus" >/dev/null; then
    echo "Starting prometheus..." >> "$LOG_FILE"
    nohup "$BREW_PREFIX/bin/prometheus" --config.file="$PROM_YML" --storage.tsdb.path="$BREW_PREFIX/var/prometheus" >> "$LOG_FILE" 2>&1 &
else
    echo "prometheus is already running." >> "$LOG_FILE"
fi

# 3. Grafana
if ! pgrep -f "grafana-server" >/dev/null; then
    echo "Starting grafana-server..." >> "$LOG_FILE"
    # Need to be in the share directory for some assets if using absolute bin
    if [ -d "$BREW_PREFIX/share/grafana" ]; then
        cd "$BREW_PREFIX/share/grafana"
    elif [ -d "$BREW_PREFIX/opt/grafana/share/grafana" ]; then
        cd "$BREW_PREFIX/opt/grafana/share/grafana"
    fi
    nohup "$BREW_PREFIX/bin/grafana-server" --config="$GRAFANA_INI" >> "$LOG_FILE" 2>&1 &
    cd - > /dev/null
else
    echo "grafana-server is already running." >> "$LOG_FILE"
fi

# 4. MacMon (M-chip specific)
if ! pgrep -f "macmon serve" >/dev/null; then
    echo "Starting macmon..." >> "$LOG_FILE"
    nohup "$BREW_PREFIX/bin/macmon" serve --port 9091 --interval 1000 >> "$LOG_FILE" 2>&1 &
else
    echo "macmon is already running." >> "$LOG_FILE"
fi

echo "$(date) - Stack initialization check complete." >> "$LOG_FILE"
