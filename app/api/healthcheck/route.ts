import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

const execAsync = util.promisify(exec);

// Support both absolute path from HOST_ROOT and relative path for Docker in Docker setups
const HOST_ROOT = process.env.NODE_ENV === 'development' 
  ? '/Users/danieldrunen/FestiFind2025' // Used when debugging locally
  : '/app'; // Path inside the Docker container

// Path to docker-wrapper.sh script
const DOCKER_WRAPPER = process.env.NODE_ENV === 'development' 
  ? path.join(HOST_ROOT, 'docker-wrapper.sh')  // Project root in development
  : '/app/docker-wrapper.sh';  // Container path in production

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Check basic health
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      nodejs: process.version,
      environment: process.env.NODE_ENV,
    };

    // Check docker
    try {
      const { stdout } = await execAsync(`${DOCKER_WRAPPER} version`);
      health['docker'] = stdout;
    } catch (error: any) {
      health['docker_error'] = error.message;
    }

    // Check socket
    try {
      const { stdout } = await execAsync('ls -la /var/run/docker.sock');
      health['docker_socket'] = stdout;
    } catch (error: any) {
      health['docker_socket_error'] = error.message;
    }

    return new Response(JSON.stringify(health, null, 2), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ status: 'error', error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
} 