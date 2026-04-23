-- Supabase SQL Schema Migration für Connect Bounty

-- 1. Tabellen erstellen
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    real_name TEXT DEFAULT '',
    date_of_birth TEXT DEFAULT '',
    country TEXT DEFAULT 'Deutschland',
    city TEXT DEFAULT '',
    postal_code TEXT DEFAULT '',
    profile_visibility TEXT DEFAULT 'public',
    referral_code TEXT UNIQUE NOT NULL,
    referral_points INTEGER DEFAULT 0,
    payment_type TEXT DEFAULT 'bank',
    payment_iban TEXT DEFAULT '',
    payment_bic TEXT DEFAULT '',
    payment_paypal TEXT DEFAULT '',
    kyc_verified BOOLEAN DEFAULT FALSE,
    kyc_status TEXT DEFAULT 'pending',
    account_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT DEFAULT '',
    bonus INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    description TEXT DEFAULT '',
    is_anonymous BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.referral_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    points_awarded INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(listing_id, applicant_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    ai_flagged BOOLEAN DEFAULT FALSE,
    ai_review_note TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Row Level Security (RLS) aktivieren
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies erstellen

-- Profiles: Jeder kann öffentliche Profile sehen, aber nur der eigene Account kann bearbeitet werden.
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR GET USING ( true );
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING ( auth.uid() = id );

-- Listings: Jeder kann aktive Listings sehen. Ersteller können ihre eigenen updaten.
CREATE POLICY "Active listings viewable by everyone." ON public.listings FOR GET USING ( status = 'active' OR auth.uid() = created_by );
CREATE POLICY "Users can insert own listings." ON public.listings FOR INSERT WITH CHECK ( auth.uid() = created_by );
CREATE POLICY "Users can update own listings." ON public.listings FOR UPDATE USING ( auth.uid() = created_by );

-- 4. Trigger für automatische Profil-Erstellung bei Auth-Registrierung
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
  new_referral_code TEXT;
BEGIN
  -- Generiere random referral code
  new_referral_code := substr(md5(random()::text), 1, 6);
  
  INSERT INTO public.profiles (id, username, email, referral_code)
  VALUES (new.id, new.raw_user_meta_data->>'username', new.email, new_referral_code);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
