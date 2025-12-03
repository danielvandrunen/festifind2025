#!/bin/bash
# A simple script to run Docker commands through the Docker socket
# This allows using Docker from containers without installing Docker CLI

# Function to display usage
function usage() {
  echo "Usage: $0 COMMAND [OPTIONS]"
  echo
  echo "Examples:"
  echo "  $0 run -it --rm ubuntu bash"
  echo "  $0 ps"
  echo "  $0 images"
  exit 1
}

# Check if we have curl
if ! command -v curl >/dev/null 2>&1; then
  echo "Error: This script requires curl. Installing curl..."
  apt-get update && apt-get install -y curl
fi

# Ensure Docker socket exists
if [ ! -S /var/run/docker.sock ]; then
  echo "Error: Docker socket not found at /var/run/docker.sock" >&2
  exit 1
fi

# Check if we have arguments
if [ $# -eq 0 ]; then
  echo "Error: No Docker command specified" >&2
  usage
fi

# Special handling for simple commands like version, info, ps, images
COMMAND="$1"
shift

case "$COMMAND" in
  version|--version|-v)
    curl -s --unix-socket /var/run/docker.sock http://localhost/version | grep -o '"Version":"[^"]*"' | cut -d':' -f2 | tr -d '"'
    ;;
  info)
    curl -s --unix-socket /var/run/docker.sock http://localhost/info
    ;;
  ps)
    curl -s --unix-socket /var/run/docker.sock http://localhost/containers/json | 
      jq -r '.[] | "\(.Id) \(.Image) \(.Status)"' 2>/dev/null || 
      grep -o '"Id":"[^"]*".*"Image":"[^"]*".*"Status":"[^"]*"' | 
      sed -e 's/"Id":"\([^"]*\).*"Image":"\([^"]*\).*"Status":"\([^"]*\).*/\1 \2 \3/'
    ;;
  images)
    curl -s --unix-socket /var/run/docker.sock http://localhost/images/json
    ;;
  run)
    # Simplified implementation for run command - extract the needed parts
    IMAGE=""
    
    # Process command line arguments and build config
    VOLUMES=()
    ENV_VARS=()
    ARGS=()
    REMOVE=false
    DETACHED=false
    CONTAINER_NAME=""
    
    while [[ $# -gt 0 ]]; do
      key="$1"
      case $key in
        -v|--volume)
          VOLUMES+=("$2")
          shift
          shift
          ;;
        -e|--env)
          ENV_VARS+=("$2")
          shift
          shift
          ;;
        --rm)
          REMOVE=true
          shift
          ;;
        -d|--detach)
          DETACHED=true
          shift
          ;;
        --name)
          CONTAINER_NAME="$2"
          shift
          shift
          ;;
        -*)
          # Skip other options for simplicity
          shift
          ;;
        *)
          # First non-option argument is the image
          if [ -z "$IMAGE" ]; then
            IMAGE="$1"
          else
            # Additional arguments are command args
            ARGS+=("$1")
          fi
          shift
          ;;
      esac
    done
    
    # Validate essential parameters
    if [ -z "$IMAGE" ]; then
      echo "Error: No image specified for docker run" >&2
      exit 1
    fi
    
    # Prepare volume binds
    BINDS="["
    for i in "${!VOLUMES[@]}"; do
      if [ $i -gt 0 ]; then
        BINDS+=","
      fi
      BINDS+="\"${VOLUMES[$i]}\""
    done
    BINDS+="]"
    
    # Prepare environment variables
    ENV_JSON="["
    for i in "${!ENV_VARS[@]}"; do
      if [ $i -gt 0 ]; then
        ENV_JSON+=","
      fi
      ENV_JSON+="\"${ENV_VARS[$i]}\""
    done
    ENV_JSON+="]"
    
    # Prepare command arguments
    CMD_ARGS="["
    for i in "${!ARGS[@]}"; do
      if [ $i -gt 0 ]; then
        CMD_ARGS+=","
      fi
      CMD_ARGS+="\"${ARGS[$i]}\""
    done
    CMD_ARGS+="]"
    
    # Create container configuration JSON
    CONFIG="{\"Image\":\"$IMAGE\",\"Cmd\":$CMD_ARGS,\"HostConfig\":{\"Binds\":$BINDS},\"Env\":$ENV_JSON"
    
    # Close the JSON object
    CONFIG="${CONFIG}}"
    
    echo "Creating container with config: $CONFIG"
    
    # Create the container with name if specified
    CREATE_URL="http://localhost/containers/create"
    if [ -n "$CONTAINER_NAME" ]; then
      CREATE_URL="${CREATE_URL}?name=${CONTAINER_NAME}"
    fi
    
    CREATE_RESPONSE=$(curl -s -X POST --unix-socket /var/run/docker.sock \
      -H "Content-Type: application/json" \
      -d "$CONFIG" \
      "$CREATE_URL")
    
    # Extract container ID or error message
    CONTAINER_ID=$(echo "$CREATE_RESPONSE" | grep -o '"Id":"[^"]*"' | cut -d':' -f2 | tr -d '"')
    ERROR_MSG=$(echo "$CREATE_RESPONSE" | grep -o '"message":"[^"]*"' | cut -d':' -f2 | tr -d '"')
    
    if [ -z "$CONTAINER_ID" ]; then
      echo "Error: Failed to create container: $ERROR_MSG" >&2
      echo "$CREATE_RESPONSE" >&2
      exit 1
    fi
    
    echo "Container created: $CONTAINER_ID"
    
    # Start the container
    START_RESPONSE=$(curl -s -X POST --unix-socket /var/run/docker.sock \
      http://localhost/containers/$CONTAINER_ID/start)
    
    if [ -n "$START_RESPONSE" ]; then
      echo "Error starting container: $START_RESPONSE" >&2
      exit 1
    fi
    
    echo "Container started"
    
    # If running in detached mode, return the container ID and exit
    if [ "$DETACHED" = true ]; then
      echo "$CONTAINER_ID"
      exit 0
    fi
    
    # Wait for container to exit with a timeout
    echo "Waiting for container to exit (timeout 30s)..."
    TIMEOUT=30
    while [ $TIMEOUT -gt 0 ]; do
      CONTAINER_STATUS=$(curl -s --unix-socket /var/run/docker.sock \
        http://localhost/containers/$CONTAINER_ID/json | grep -o '"State":{"Status":"[^"]*"' | cut -d':' -f4 | tr -d '"')
      
      if [ "$CONTAINER_STATUS" = "exited" ]; then
        break
      fi
      
      echo "Container status: $CONTAINER_STATUS. Waiting..."
      sleep 1
      TIMEOUT=$((TIMEOUT-1))
    done
    
    # Get exit code
    EXIT_CODE=$(curl -s --unix-socket /var/run/docker.sock \
      http://localhost/containers/$CONTAINER_ID/json | grep -o '"ExitCode":[0-9]*' | cut -d':' -f2)
    echo "Container exited with code: $EXIT_CODE"
    
    # Get container logs
    LOGS=$(curl -s --unix-socket /var/run/docker.sock \
      "http://localhost/containers/$CONTAINER_ID/logs?stdout=1&stderr=1&timestamps=0")
    
    echo "$LOGS"
    
    # Remove container if --rm was specified
    if [ "$REMOVE" = true ]; then
      if [ "$CONTAINER_STATUS" = "exited" ]; then
        echo "Removing container: $CONTAINER_ID"
        curl -s -X DELETE --unix-socket /var/run/docker.sock \
          http://localhost/containers/$CONTAINER_ID
      else 
        echo "Container is still running, cannot remove"
      fi
    fi
    
    if [ "$EXIT_CODE" != "0" ]; then
      exit $EXIT_CODE
    fi
    ;;
  logs)
    # Get container logs
    if [ $# -lt 1 ]; then
      echo "Error: Container ID required for logs command" >&2
      exit 1
    fi
    
    CONTAINER_ID="$1"
    TAIL_OPTION=""
    
    # Check for --tail option
    if [ "$1" = "--tail" ]; then
      TAIL_OPTION="&tail=$2"
      shift 2
      CONTAINER_ID="$1"
    fi
    
    # Get logs from the Docker API and completely clean up Docker's binary stream format
    # Using a more aggressive approach to clean binary output
    curl -s --unix-socket /var/run/docker.sock \
      "http://localhost/containers/$CONTAINER_ID/logs?stdout=1&stderr=1$TAIL_OPTION" | 
      sed -E 's/^[^[:print:]]*(.*)$/\1/' | 
      grep -v "^\s*$"
    ;;
  stop)
    # Stop a container
    if [ $# -lt 1 ]; then
      echo "Error: Container ID required for stop command" >&2
      exit 1
    fi
    
    CONTAINER_ID="$1"
    
    # Stop the container
    curl -s -X POST --unix-socket /var/run/docker.sock \
      http://localhost/containers/$CONTAINER_ID/stop
    
    echo "Container $CONTAINER_ID stopped"
    ;;
    
  rm)
    # Remove a container
    if [ $# -lt 1 ]; then
      echo "Error: Container ID required for rm command" >&2
      exit 1
    fi
    
    CONTAINER_ID="$1"
    
    # Remove the container
    RESPONSE=$(curl -s -X DELETE --unix-socket /var/run/docker.sock \
      http://localhost/containers/$CONTAINER_ID)
    
    if [ -n "$RESPONSE" ]; then
      echo "Error removing container: $RESPONSE" >&2
      exit 1
    fi
    
    echo "Container $CONTAINER_ID removed"
    ;;
  *)
    echo "Unsupported command: $COMMAND"
    echo "This is a simplified Docker wrapper. Only basic commands are supported."
    exit 1
    ;;
esac 