#!/bin/bash
# Setup script for a "Lightning" Claude Code cloud environment. Paste it into
# the environment's Setup script box. It installs what every Lightning session
# needs and doesn't depend on a branch, so it lands in the cached environment
# snapshot and later sessions start with it on disk.
#
# It has to finish in about five minutes or the environment isn't cached, and a
# non-zero exit stops the session from starting, so every step here is
# best-effort: a failure is logged and the next session (or the skill's
# setup.sh) does that part instead.
#
# Does:
#   - Erlang/OTP + Elixir at the versions in Lightning main's .tool-versions,
#     into /opt/beam, on PATH for every shell
#   - apt packages Lightning's native deps need
#   - Postgres password set to match config/dev.exs (the server itself is
#     stopped again: the snapshot keeps files, not running processes)
#   - Hex, rebar and npm package caches warmed from main, so mix deps.get and
#     npm install in the session mostly read from disk
#
# Leaves to the session: compile, assets, migrate, seed, start the server.
# Log: /var/log/lightning-env-setup.log

LOG=/var/log/lightning-env-setup.log
exec > >(tee -a "$LOG") 2>&1
START=$SECONDS
step() { printf '\n==> [%ss] %s\n' "$((SECONDS - START))" "$*"; }

BEAM=/opt/beam
REPO=https://github.com/OpenFn/lightning

# Versions from main, with a fallback if GitHub is unreachable.
TV=$(curl -sSfL --max-time 20 https://raw.githubusercontent.com/OpenFn/lightning/main/.tool-versions || true)
OTP_VSN=$(awk '/^erlang /{print $2}' <<<"$TV"); OTP_VSN=${OTP_VSN:-28.5}
EX_VSN=$(awk '/^elixir /{print $2}' <<<"$TV");  EX_VSN=${EX_VSN:-1.18.4-otp-28}

# 1. Native build deps (enacl needs sodium.h; the rest are what bin/bootstrap
#    checks for on Debian; unzip is for the Elixir zip).
missing=()
for p in build-essential libsodium-dev cmake inotify-tools unzip; do
  dpkg -s "$p" >/dev/null 2>&1 || missing+=("$p")
done
if ((${#missing[@]})); then
  step "apt-get install ${missing[*]}"
  { apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${missing[@]}" >/dev/null; } \
    || echo "!! apt-get failed"
fi

# 2. Erlang + Elixir. Ubuntu's are far too old; hex.pm publishes prebuilt ones.
#    /opt/beam/VERSIONS is what the skill's setup.sh checks to skip this.
install_beam() {
  [[ "$(cat $BEAM/VERSIONS 2>/dev/null)" == "$OTP_VSN $EX_VSN" ]] && return 0
  step "Installing Erlang/OTP $OTP_VSN and Elixir $EX_VSN"
  rm -rf $BEAM && mkdir -p $BEAM/otp $BEAM/elixir
  # The OTP build installs in place: unpack where it will live, then Install.
  curl -sSfL "https://builds.hex.pm/builds/otp/amd64/ubuntu-24.04/OTP-${OTP_VSN}.tar.gz" \
    | tar xz -C $BEAM/otp --strip-components=1 || return 1
  (cd $BEAM/otp && ./Install -minimal $BEAM/otp >/dev/null) || return 1
  curl -sSfL -o /tmp/elixir.zip "https://builds.hex.pm/builds/elixir/v${EX_VSN}.zip" || return 1
  unzip -qo /tmp/elixir.zip -d $BEAM/elixir && rm -f /tmp/elixir.zip || return 1
  echo "$OTP_VSN $EX_VSN" > $BEAM/VERSIONS
}
install_beam || echo "!! Erlang/Elixir install failed; setup.sh will retry"

# Put it on PATH for login and non-login shells alike.
cat > /etc/profile.d/beam.sh <<EOF
export PATH=$BEAM/otp/bin:$BEAM/elixir/bin:\$PATH
export LANG=C.UTF-8 ELIXIR_ERL_OPTIONS=+fnu
EOF
grep -q profile.d/beam.sh /root/.bashrc 2>/dev/null \
  || echo '[ -f /etc/profile.d/beam.sh ] && . /etc/profile.d/beam.sh' >> /root/.bashrc
. /etc/profile.d/beam.sh

# 3. Postgres: set the password config/dev.exs expects, then stop it cleanly
#    so the snapshot's data directory is consistent.
step "Postgres password"
if pg_ctlcluster 16 main start 2>/dev/null || pg_isready -q -h localhost; then
  su postgres -c "psql -qc \"ALTER USER postgres PASSWORD 'postgres';\"" || true
  pg_ctlcluster 16 main stop || true
fi

# 4. Warm package caches from main (~/.hex, ~/.mix, ~/.npm). Skipped if the
#    steps above already used most of the five-minute budget.
if command -v mix >/dev/null && (( SECONDS - START < 150 )); then
  step "Warming Hex and npm caches from Lightning main"
  W=/tmp/lightning-warm
  rm -rf $W
  if git clone -q --depth 1 "$REPO" $W; then
    ( cd $W
      mix local.hex --force --if-missing >/dev/null
      mix local.rebar --force --if-missing >/dev/null
      timeout 120 mix deps.get >/dev/null || echo "!! mix deps.get incomplete"
      timeout 90 npm ci --prefix assets --no-audit --no-fund --ignore-scripts >/dev/null 2>&1 \
        || echo "!! npm cache warm incomplete"
    )
  fi
  rm -rf $W
else
  step "Skipping cache warm-up"
fi

step "Done"
exit 0
