import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { AuthDialog } from "@/components/AuthDialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart, Users, CheckCircle2, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.svg";
import heroLight from "@/assets/hero-light.png";
import heroDark from "@/assets/hero-dark.png";
import carouselTodos from "@/assets/carousel-todos.png";
import carouselShopping from "@/assets/carousel-shopping-new.png";
import carouselWorkspaces from "@/assets/carousel-workspaces-new.png";
import stickerHi from "@/assets/sticker-hi.svg";
import stickerLove from "@/assets/sticker-love.svg";
import stickerThumbsup from "@/assets/sticker-thumbsup.svg";
import stickerChecklist from "@/assets/sticker-checklist.svg";
const carouselSlides = [{
  image: carouselTodos,
  icon: CheckCircle2,
  title: "To-Do Lists",
  description: <>Create, prioritize, and complete tasks <span className="text-primary font-medium">together</span>. See what's next at a glance.</>
}, {
  image: carouselShopping,
  icon: ShoppingCart,
  title: "Shopping Lists",
  description: <>Never forget the milk again. Share shopping lists that update in <span className="text-primary font-medium">real-time</span> as you shop.</>
}, {
  image: carouselWorkspaces,
  icon: Users,
  title: "Shared Workspaces",
  description: <>Invite your partner, family, or roommates. <span className="text-primary font-medium">Everyone</span> stays on the same page.</>
}];
const Landing = () => {
  const [authOpen, setAuthOpen] = useState(false);
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Redirect authenticated users straight to /app
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/app", { replace: true });
      } else {
        setCheckingAuth(false);
      }
    });
  }, [navigate]);

  // Auto-advance carousel every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSignUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    navigate("/app");
  };

  const handleSignIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    navigate("/app");
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-background" />;
  }

  return <div className="min-h-screen bg-background">
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onSignUp={handleSignUp} onSignIn={handleSignIn} />
      {/* Hero Section with curved green background */}
      <div className="relative">
        {/* Curved green background shape */}
        <div className="absolute inset-0 bg-landing-hero" style={{
        clipPath: 'ellipse(120% 100% at 50% 0%)',
        height: '90%'
      }} />
        
        <header className="relative py-6">
          <div className="container mx-auto px-6">
            {/* Navigation */}
            <nav className="flex items-center justify-between mb-16">
              <div className="flex items-center gap-2">
                <img src={logo} alt="honeydew, please." className="w-10 h-auto" />
                <span className="text-xl font-bold text-foreground">honeydew, please.</span>
              </div>
              <Button variant="outline" className="rounded-full border-foreground/20 hover:bg-background/50" onClick={() => setAuthOpen(true)}>
                  Sign In
                </Button>
            </nav>

            {/* Hero Content */}
            <div className="grid md:grid-cols-2 gap-4 items-center max-w-4xl mx-auto pb-24 relative">
              {/* Sticker - Hi */}
              <img src={stickerHi} alt="" className="absolute -top-8 right-0 md:right-12 w-20 h-20 rotate-12 pointer-events-none select-none hidden md:block" />

              {/* Left - Phone Image */}
              <div className="flex justify-center md:justify-end order-2 md:order-1">
                <div className="relative">
                  <img src={heroLight} alt="honeydew, please. app preview" className="h-[400px] md:h-[480px] w-auto rounded-3xl shadow-2xl dark:hidden" />
                  <img src={heroDark} alt="honeydew, please. app preview" className="h-[400px] md:h-[480px] w-auto rounded-3xl shadow-2xl hidden dark:block" />
                </div>
              </div>

              {/* Right - Text and Button */}
              <div className="text-center md:text-left order-1 md:order-2 max-w-md mx-auto md:mx-0">
                <div className="inline-flex items-center gap-2 bg-white text-[hsl(210,20%,18%)] px-4 py-2 rounded-full text-sm font-medium mb-6 shadow-sm">
                  <span>🍈
                </span>
                  <span>Simple. Shared. Sorted.</span>
                </div>
                
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
                  Organize life together,{" "}
                  <span className="text-primary">one task at a time.</span>
                </h1>
                
                <p className="text-base md:text-lg text-muted-foreground mb-8">
                  A task manager for couples, families, and roommates. Share to-dos, 
                  coordinate shopping lists, and stay in sync without the chaos. 🍈
                </p>

                <div className="flex flex-col sm:flex-row items-center md:items-start gap-3">
                  <Link to="/app">
                    <Button size="lg" className="rounded-full px-6 gap-2 text-base font-semibold">
                      Start Now
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <p className="text-sm text-muted-foreground flex items-center">
                    No account required
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-background relative">
        <img src={stickerChecklist} alt="" className="absolute top-8 left-4 md:left-16 w-16 h-16 -rotate-12 pointer-events-none select-none opacity-80" />
        <img src={stickerThumbsup} alt="" className="absolute bottom-8 right-4 md:right-16 w-14 h-14 rotate-6 pointer-events-none select-none opacity-80" />
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need, nothing you don't.
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built for real life with real people. Simple tools that just work.
            </p>
          </div>

          {/* Carousel + Feature Cards Side by Side */}
          <div className="grid md:grid-cols-[auto_240px] gap-3 max-w-xl mx-auto items-center">
            {/* Left - Phone Screenshots Carousel */}
            <div className="flex flex-col items-center justify-self-center md:justify-self-start">
              {/* Carousel Dots */}
              <div className="flex justify-center gap-2 mb-6">
                {carouselSlides.map((_, index) => <button key={index} onClick={() => setActiveSlide(index)} className={`w-2.5 h-2.5 rounded-full transition-colors ${index === activeSlide ? 'bg-primary' : 'bg-muted-foreground/30'}`} aria-label={`Go to slide ${index + 1}`} />)}
              </div>

              <div className="overflow-hidden w-full max-w-[240px] mx-auto">
                <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${activeSlide * 100}%)`
              }}>
                  {carouselSlides.map((slide, index) => <div key={index} className="w-full flex-shrink-0 flex justify-center min-w-full">
                      <img src={slide.image} alt={slide.title} className="h-[350px] md:h-[420px] w-auto object-contain" />
                    </div>)}
                </div>
              </div>
            </div>

            {/* Right - Feature Cards Stacked */}
            <div className="flex flex-col gap-4">
              {carouselSlides.map((slide, index) => {
              const Icon = slide.icon;
              return <button key={index} onClick={() => setActiveSlide(index)} className={`text-left p-4 rounded-xl transition-all ${index === activeSlide ? 'bg-accent/50' : 'hover:bg-muted/50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-primary" />
                      <h3 className="text-lg font-semibold text-foreground">{slide.title}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {slide.description}
                    </p>
                  </button>;
            })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 bg-primary relative overflow-hidden">
        <img src={stickerLove} alt="" className="absolute -bottom-4 left-4 md:left-20 w-20 h-20 -rotate-6 pointer-events-none select-none opacity-60" />
        <img src={stickerHi} alt="" className="absolute top-4 right-4 md:right-20 w-16 h-16 rotate-12 pointer-events-none select-none opacity-60" />
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to get organized?
            </h2>
            <p className="text-base md:text-lg text-primary-foreground/80 mb-8">
              Join others who've simplified their shared to-do lists. Start for free and see the difference.
            </p>
            <Link to="/app">
              <Button size="lg" variant="secondary" className="rounded-full px-6 gap-2 text-base font-semibold bg-white text-primary hover:bg-white/90">
                Start Using honeydew, please.
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-background">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <span className="text-sm text-muted-foreground">
                honeydew, please. by <a href="https://catdeleon.design/contact" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">Cat de Leon</a>
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Made with care for people who care about each other.
            </p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Landing;