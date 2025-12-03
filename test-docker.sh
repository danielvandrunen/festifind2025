#!/bin/sh
if [ -S /var/run/docker.sock ]; then
  echo "Docker socket exists"
else
  echo "Docker socket does not exist at /var/run/docker.sock"
fi 