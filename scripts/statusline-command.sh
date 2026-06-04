#!/bin/bash

input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Unknown Model"')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

if [ -n "$used" ]; then
  used_int=$(printf "%.0f" "$used")
  bar_width=20
  filled=$(( used_int * bar_width / 100 ))
  empty=$(( bar_width - filled ))
  bar=""
  for i in $(seq 1 $filled); do bar="${bar}█"; done
  for i in $(seq 1 $empty); do bar="${bar}░"; done
  printf "\033[1;36m%s\033[0m  [%s] %d%%" "$model" "$bar" "$used_int"
else
  printf "\033[1;36m%s\033[0m  [░░░░░░░░░░░░░░░░░░░░] 0%%" "$model"
fi
