#!/bin/bash

# Generate starter templates for Claude Code

set -e

echo "🎨 Generating starter templates..."

# API app structure
mkdir -p apps/api/src/{modules,config,common,graphql}

# Create API main file
cat > apps/api/src/main.ts << 'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  // CORS
  app.enableCors({
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  });
  
  const port = process.env.PORT || 4000;
  await app.listen(port);
  
  console.log(`🚀 API running on http://localhost:${port}`);
  console.log(`📊 GraphQL playground: http://localhost:${port}/graphql`);
}

bootstrap();
EOF

# Create API app module
cat > apps/api/src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      playground: process.env.NODE_ENV !== 'production',
      context: ({ req }) => ({ req }),
    }),
  ],
})
export class AppModule {}
EOF

# Create API package.json
cat > apps/api/package.json << 'EOF'
{
  "name": "@hastecrm/api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "@nestjs/graphql": "^12.0.0",
    "@nestjs/apollo": "^12.0.0",
    "@apollo/server": "^4.9.0",
    "graphql": "^16.6.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "@hastecrm/database": "workspace:*",
    "@hastecrm/types": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  }
}
EOF

# Create Web app structure
mkdir -p apps/web/{src,public,components,lib,hooks}

# Create Web package.json
cat > apps/web/package.json << 'EOF'
{
  "name": "@hastecrm/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@apollo/client": "^3.8.0",
    "graphql": "^16.6.0",
    "@hastecrm/types": "workspace:*",
    "@hastecrm/ui": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.3.0",
    "typescript": "^5.3.0"
  }
}
EOF

# Create Next.js config
cat > apps/web/next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hastecrm/ui', '@hastecrm/types'],
}

module.exports = nextConfig
EOF

# Create Web app page
mkdir -p apps/web/src/app
cat > apps/web/src/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to hasteCRM</h1>
      <p className="mt-4 text-xl text-gray-600">
        Your AI-powered CRM platform
      </p>
    </main>
  );
}
EOF

# Create Web layout
cat > apps/web/src/app/layout.tsx << 'EOF'
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'hasteCRM',
  description: 'AI-powered CRM platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
EOF

# Create global CSS
cat > apps/web/src/app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# Create Tailwind config
cat > apps/web/tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
EOF

# Create UI package
cat > packages/ui/package.json << 'EOF'
{
  "name": "@hastecrm/ui",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
EOF

# Create UI components
mkdir -p packages/ui/src/components
cat > packages/ui/src/index.ts << 'EOF'
// Export all UI components
export * from './components/Button';
export * from './components/Card';
EOF

cat > packages/ui/src/components/Button.tsx << 'EOF'
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const baseClasses = 'font-medium rounded-lg transition-colors';
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  );
};
EOF

cat > packages/ui/src/components/Card.tsx << 'EOF'
import React from 'react';

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, children, className }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className || ''}`}>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
      {children}
    </div>
  );
};
EOF

# Create shared utilities
cat > packages/shared/package.json << 'EOF'
{
  "name": "@hastecrm/shared",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo",
    "test": "jest"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.3.0"
  }
}
EOF

mkdir -p packages/shared/src/{utils,services}
cat > packages/shared/src/index.ts << 'EOF'
// Export utilities
export * from './utils/logger';
export * from './utils/errors';

// Export services
export * from './services/mock-ai';
EOF

cat > packages/shared/src/utils/logger.ts << 'EOF'
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  constructor(private context: string) {}
  
  private log(level: LogLevel, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${LogLevel[level]}] [${this.context}] ${message}`;
    
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
  
  debug(message: string, data?: any) {
    if (process.env.LOG_LEVEL === 'debug') {
      this.log(LogLevel.DEBUG, message, data);
    }
  }
  
  info(message: string, data?: any) {
    this.log(LogLevel.INFO, message, data);
  }
  
  warn(message: string, data?: any) {
    this.log(LogLevel.WARN, message, data);
  }
  
  error(message: string, error?: any) {
    this.log(LogLevel.ERROR, message, error);
  }
}
EOF

cat > packages/shared/src/utils/errors.ts << 'EOF'
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
EOF

# Create test configuration
cat > jest.config.base.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.ts',
  ],
};
EOF

echo "✅ Templates generated successfully!"
echo ""
echo "Project structure is ready for Claude Code to start implementation."