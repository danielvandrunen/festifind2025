"use client"

import React, { useState, useEffect } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { useInView } from 'framer-motion'
import { 
  Search, 
  MapPin, 
  Calendar, 
  Users, 
  Music, 
  Ticket, 
  Heart,
  ChevronRight,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { useAuth } from '../../app/contexts/AuthContext'
import Image from 'next/image'

interface FormData {
  email: string
  password: string
  name?: string
}

interface FormErrors {
  email?: string
  password?: string
  name?: string
}

interface FormState {
  isLoading: boolean
  isSuccess: boolean
  errors: FormErrors
}

const FestiFindLanding: React.FC = () => {
  const { signIn, signUp, user } = useAuth()
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    name: ''
  })
  const [formState, setFormState] = useState<FormState>({
    isLoading: false,
    isSuccess: false,
    errors: {}
  })
  const [showPassword, setShowPassword] = useState(false)
  const [isFormVisible, setIsFormVisible] = useState(false)

  const heroControls = useAnimation()

  useEffect(() => {
    heroControls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" }
    })
  }, [heroControls])

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePassword = (password: string): boolean => {
    return password.length >= 8
  }

  const validateForm = (): boolean => {
    const errors: FormErrors = {}

    if (!formData.email) {
      errors.email = 'Email is required'
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email'
    }

    if (!formData.password) {
      errors.password = 'Password is required'
    } else if (!validatePassword(formData.password)) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (activeTab === 'signup' && !formData.name) {
      errors.name = 'Name is required'
    }

    setFormState(prev => ({ ...prev, errors }))
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Real-time validation
    if (formState.errors[field]) {
      const newErrors = { ...formState.errors }
      delete newErrors[field]
      setFormState(prev => ({ ...prev, errors: newErrors }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setFormState(prev => ({ ...prev, isLoading: true, errors: {} }))

    try {
      let result;
      
      if (activeTab === 'login') {
        result = await signIn(formData.email, formData.password)
      } else {
        result = await signUp(formData.email, formData.password, formData.name)
      }

      if (result.error) {
        // Handle authentication errors
        const errorMessage = result.error.message || 'Authentication failed'
        setFormState(prev => ({
          ...prev,
          isLoading: false,
          errors: { email: errorMessage }
        }))
      } else {
        // Success - the AuthContext will handle the redirect
        setFormState({
          isLoading: false,
          isSuccess: true,
          errors: {}
        })
        
        // Clear form after successful auth
        setTimeout(() => {
          setFormData({ email: '', password: '', name: '' })
          setFormState(prev => ({ ...prev, isSuccess: false }))
        }, 1000)
      }
    } catch (error) {
      console.error('Authentication error:', error)
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        errors: { email: 'An unexpected error occurred. Please try again.' }
      }))
    }
  }

  const features = [
    {
      icon: Search,
      title: "Smart Festival Discovery",
      description: "AI-powered search to find festivals that match your interests, location, and preferences"
    },
    {
      icon: MapPin,
      title: "Global Festival Map",
      description: "Discover festivals worldwide with detailed location insights and travel information"
    },
    {
      icon: Calendar,
      title: "Personal Calendar",
      description: "Track upcoming festivals and plan your festival calendar with smart scheduling"
    },
    {
      icon: Ticket,
      title: "Ticket Integration",
      description: "Get notified about ticket releases and find the best deals for your favorite festivals"
    },
    {
      icon: Users,
      title: "Community Features",
      description: "Connect with other festival-goers and share experiences and recommendations"
    },
    {
      icon: Heart,
      title: "Favorites & Wishlist",
      description: "Save your favorite festivals and create wishlists for future festival adventures"
    }
  ]

  const FadeInWhenVisible: React.FC<{ children: React.ReactNode; delay?: number }> = ({ 
    children, 
    delay = 0 
  }) => {
    const ref = React.useRef(null)
    const isInView = useInView(ref, { once: true })

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.6, delay }}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-cyan-500/20 to-teal-400/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        
        {/* Floating Elements */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-blue-400/30 rounded-full"
              animate={{
                x: [0, 100, 0],
                y: [0, -100, 0],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 8 + i * 2,
                repeat: Infinity,
                delay: i * 1.5
              }}
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={heroControls}
              className="text-center lg:text-left"
            >
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-center lg:justify-start mb-8"
              >
                <div className="flex items-center space-x-3">
                  <Image
                    src="/logo.svg"
                    alt="FestiFind"
                    width={192}
                    height={48}
                    className="w-48 h-12"
                  />
                  <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    FestiFind
                  </span>
                </div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              >
                Discover Your Next
                <span className="block bg-gradient-to-r from-blue-800 via-cyan-700 to-teal-600 bg-clip-text text-transparent">
                  Festival Adventure
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-xl text-muted-foreground mb-8 max-w-2xl"
              >
                Your ultimate companion for discovering, tracking, and planning festival experiences worldwide. 
                From music festivals to cultural celebrations - find your perfect event.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-lg font-semibold rounded-xl border-2 hover:bg-black hover:text-white hover:border-black transition-all duration-300"
                  onClick={() => setIsFormVisible(true)}
                >
                  Start Discovering
                  <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-lg font-semibold rounded-xl border-2 hover:bg-muted/50 transition-all duration-300"
                >
                  Watch Demo
                </Button>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="grid grid-cols-3 gap-8 mt-12 pt-8 border-t border-border/50"
              >
                {[
                  { number: "10K+", label: "Festivals" },
                  { number: "50K+", label: "Users" },
                  { number: "100+", label: "Countries" }
                ].map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stat.number}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Auth Form */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: isFormVisible ? 1 : 0.7, x: 0 }}
              transition={{ delay: 0.6 }}
              className="relative"
            >
              <Card className="p-8 backdrop-blur-sm bg-card/80 border-border/50 shadow-2xl">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'login' | 'signup')}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="login" className="text-sm font-medium">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="text-sm font-medium">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-4">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold">Welcome Back</h3>
                      <p className="text-muted-foreground">Access your festival dashboard</p>
                    </div>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4">
                    <div className="text-center mb-6">
                      <h3 className="text-2xl font-bold">Join FestiFind</h3>
                      <p className="text-muted-foreground">Start discovering amazing festivals</p>
                    </div>
                  </TabsContent>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {activeTab === 'signup' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                      >
                        <Label htmlFor="name">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="name"
                            type="text"
                            placeholder="Enter your full name"
                            value={formData.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className={`pl-10 ${formState.errors.name ? 'border-red-500' : ''}`}
                          />
                        </div>
                        {formState.errors.name && (
                          <motion.p
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="w-4 h-4" />
                            {formState.errors.name}
                          </motion.p>
                        )}
                      </motion.div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className={`pl-10 ${formState.errors.email ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {formState.errors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {formState.errors.email}
                        </motion.p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className={`pl-10 pr-10 ${formState.errors.password ? 'border-red-500' : ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {formState.errors.password && (
                        <motion.p
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-sm text-red-500 flex items-center gap-1"
                        >
                          <AlertCircle className="w-4 h-4" />
                          {formState.errors.password}
                        </motion.p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full !bg-gradient-to-r !from-slate-800 !to-slate-900 hover:!from-black hover:!to-black !text-white font-semibold py-6 rounded-xl transition-all duration-300 !border-none"
                      disabled={formState.isLoading}
                    >
                      {formState.isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {activeTab === 'login' ? 'Signing In...' : 'Creating Account...'}
                        </>
                      ) : formState.isSuccess ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Success!
                        </>
                      ) : (
                        activeTab === 'login' ? 'Sign In' : 'Create Account'
                      )}
                    </Button>
                  </form>
                </Tabs>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInWhenVisible>
            <div className="text-center mb-16">
              <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm font-medium">
                Features
              </Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                Everything You Need to
                <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Discover Festivals
                </span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                From AI-powered discovery to personal calendars, 
                FestiFind has all the tools you need for your perfect festival experience.
              </p>
            </div>
          </FadeInWhenVisible>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FadeInWhenVisible key={index} delay={index * 0.1}>
                <motion.div
                  whileHover={{ y: -5, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="p-8 h-full hover:shadow-lg transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mr-4">
                        <feature.icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold">{feature.title}</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </Card>
                </motion.div>
              </FadeInWhenVisible>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10" />
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <FadeInWhenVisible>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Ready to Discover
              <span className="block bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Amazing Festivals?
              </span>
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of festival enthusiasts who trust FestiFind to discover 
              and plan their perfect festival experiences.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-6 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Start Free Trial
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="px-8 py-6 text-lg font-semibold rounded-xl border-2 hover:bg-muted/50 transition-all duration-300"
              >
                Learn More
              </Button>
            </div>
          </FadeInWhenVisible>
        </div>
      </section>
    </div>
  )
}

export default FestiFindLanding 