import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVeetaa } from '../context/VeetaaContext';
import burgerImage from '../../bergeur.png';
import tacosImage from '../../tacos.png';
import colaImage from '../../cola.png';
import livreurImage from '../../livreur.png';
import pharmacieImage from '../../pharmacie.png';
import { safeRemoveItem, safeSetItem } from '../lib/storage';
import { sanitizeSearchInput } from '../lib/security';
import SplashCursor from '../components/SplashCursor';

import { TRANSLATIONS } from '../constants';
import { Language, Store } from '../types';

import { 
  ShoppingBag, 
  MapPin, 
  ChevronRight, 
  Search, 
  Star, 
  Truck, 
  Store as StoreIcon, 
  Smartphone, 
  UserPlus, 
  Handshake, 
  Briefcase,
  Instagram,
  Facebook,
  Twitter
} from 'lucide-react';

interface WelcomeProps {
  onStart: () => void | Promise<void>;
  language: Language;
}

const LandingPage: React.FC<WelcomeProps> = ({ onStart, language }) => {
  const navigate = useNavigate();
  const { storesData, deliveryZones = [], setUserLocation, refreshLocation, loadingLocation } = useVeetaa();
  const [randomStores, setRandomStores] = useState<Store[]>([]);
  const [scrolled, setScrolled] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedCityName, setSelectedCityName] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [startError, setStartError] = useState('');


  const t = (key: string) => TRANSLATIONS[language][key] || key;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (storesData && storesData.length > 0) {
      // Initial selection of 6 stores
      const shuffled = [...storesData].sort(() => 0.5 - Math.random());
      setRandomStores(shuffled.slice(0, 8));

      const interval = setInterval(() => {
        setRandomStores(current => {
          const next = [...current];
          if (next.length === 0) return next;

          // Pick a random slot to replace
          const slotToReplace = Math.floor(Math.random() * next.length);
          
          // Find a store that isn't currently displayed
          const pool = storesData.filter((s: Store) => !next.some((ns: Store) => ns.id === s.id));

          
          if (pool.length > 0) {
            const newStore = pool[Math.floor(Math.random() * pool.length)];
            next[slotToReplace] = newStore;
          } else if (storesData.length > next.length) {
            // Fallback if filter fails but pool should exist
            const fallback = storesData[Math.floor(Math.random() * storesData.length)];
            next[slotToReplace] = fallback;
          }
          return next;
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [storesData]);



  const gold = "#D4AF37";
  const darkGold = "#B8860B";
  const black = "#000000";
  const white = "#FFFFFF";


  const categories = [
    t('food'), t('pharmacie'), t('boulangerie'), 
    t('pressing'), t('legumes'), t('market'), t('express')
  ];
  const heroSlogans = [
    'Tout ce que vous voulez, livré vite.',
    'Everything you want, delivered fast.'
  ];
  const availableCities = Array.isArray(deliveryZones)
    ? deliveryZones
      .filter((z: any) => z?.name)
      .map((z: any) => ({ name: String(z.name), lat: Number(z.center_lat || 0), lon: Number(z.center_lng || 0) }))
      .filter((z: any) => Number.isFinite(z.lat) && Number.isFinite(z.lon))
      .sort((a: any, b: any) => a.name.localeCompare(b.name, 'fr'))
    : [];
  const filteredCities = availableCities.filter((c: any) =>
    c.name.toLowerCase().includes(citySearch.trim().toLowerCase())
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % heroSlogans.length);
    }, 2800);

    return () => window.clearInterval(interval);
  }, [heroSlogans.length]);

  useEffect(() => {
    const imageInterval = window.setInterval(() => {
      setHeroImageIndex((prev) => (prev + 1) % 5);
    }, 2400);

    return () => window.clearInterval(imageInterval);
  }, []);

  const openStartModal = () => {
    setStartError('');
    setCitySearch('');
    setSelectedCityName('');
    setShowStartModal(true);
  };

  const handleChooseCity = async () => {
    if (!selectedCityName) {
      setStartError(language === 'en' ? 'Please select a city first.' : 'Veuillez choisir une ville.');
      return;
    }

    const city = availableCities.find((c: any) => c.name === selectedCityName);
    if (!city) {
      setStartError(language === 'en' ? 'Selected city is unavailable.' : 'La ville selectionnee est indisponible.');
      return;
    }

    const nextLocation = { lat: city.lat, lon: city.lon, city: city.name };
    setUserLocation(nextLocation);
    safeSetItem('userLocation', JSON.stringify(nextLocation));
    safeSetItem('veetaa_manual_city_override', '1');
    setShowStartModal(false);
    await onStart();
  };

  const handleUseLocation = async () => {
    setStartError('');
    try {
      safeRemoveItem('veetaa_manual_city_override');
      await refreshLocation();
      setShowStartModal(false);
      await onStart();
    } catch {
      setStartError(language === 'en' ? 'Unable to use your location.' : 'Impossible d utiliser votre localisation.');
    }
  };

  const features = [
    {
      title: "Les meilleurs restaurants de votre ville",
      desc: "Retrouvez vos plats préférés parmi un large choix de restaurants partenaires à Kenitra. Burger, tacos, pizza, tajine, couscous, cuisine marocaine traditionnelle et internationale — commandez en quelques clics et recevez votre repas chaud à domicile.",
      icon: <Star size={40} color={gold} />
    },
    {
      title: "Livraison rapide et fiable",
      desc: "Nous livrons tout ce que vous voulez, là où vous êtes, en un clin d'œil. Nos coursiers professionnels assurent une livraison express à Kenitra et environs. Suivi en temps réel de votre commande depuis la préparation jusqu'à la livraison.",
      icon: <Truck size={40} color={gold} />
    },
    {
      title: "Courses, pharmacie et bien plus",
      desc: "Supermarché en ligne, épicerie, fruits et légumes, produits de pharmacie, boulangerie, pressing — Veetaa est votre allié pour toutes vos courses à domicile à Kenitra. Un seul service pour tous vos besoins quotidiens.",
      icon: <ShoppingBag size={40} color={gold} />
    }
  ];

  return (
    <div style={{ backgroundColor: black, color: white, fontFamily: 'Outfit, sans-serif' }}>
      <SplashCursor COLOR="#EAB308" />
      {/* Navbar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '80px',
        backgroundColor: scrolled ? 'rgba(0,0,0,0.8)' : 'transparent',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8%',
        zIndex: 1000,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        borderBottom: scrolled ? `1px solid rgba(212, 175, 55, 0.2)` : 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="/logo.png" alt="Veetaa" style={{ height: '54px', filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.2))' }} />
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/login')}
            style={{
              backgroundColor: 'transparent',
              color: white,
              border: 'none',
              padding: '10px 20px',
              fontWeight: '700',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            {t('login')}
          </button>
          <button 
            onClick={() => navigate('/signup')}
            style={{
              backgroundColor: gold,
              color: black,
              border: 'none',
              padding: '12px 32px',
              borderRadius: '99px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: `0 10px 20px -5px ${gold}44`,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {t('signup')}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '120px 20px 60px',
        background: `radial-gradient(circle at 50% 50%, #151515 0%, ${black} 100%)`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ zIndex: 1, maxWidth: '1200px', width: '100%' }}>
          <div className="hero-main-layout">
            <div className="hero-text-block">
              <h1 style={{ 
                fontSize: 'clamp(1.8rem, 4.2vw, 4rem)', 
                fontWeight: '950', 
                margin: '0 0 30px 0',
                lineHeight: '1.05',
                letterSpacing: '-0.04em',
                filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))',
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <span key={phraseIndex} className="hero-slogan-line">
                  {heroSlogans[phraseIndex]}
                </span>
              </h1>
              <p style={{ fontSize: '1.25rem', color: '#aaaaaa', marginBottom: '40px', fontWeight: '500' }}>
                Découvrez les meilleurs restaurants, supermarchés, pharmacies et commerces de proximité de Kenitra.
                Commandez en ligne et recevez vos repas, courses alimentaires et produits de pharmacie livrés à domicile en quelques minutes.
              </p>
              
              <button 
                onClick={openStartModal}
                style={{
                  backgroundColor: gold,
                  color: black,
                  padding: '20px 60px',
                  borderRadius: '40px',
                  fontSize: '1.25rem',
                  fontWeight: '900',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 20px 40px -10px ${gold}66`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px) scale(1.05)';
                  e.currentTarget.style.boxShadow = `0 25px 50px -10px ${gold}88`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = `0 20px 40px -10px ${gold}66`;
                }}
              >
                {t('getStarted')}
              </button>
            </div>
            <div className="hero-images-frame">
              <img
                src={burgerImage}
                alt="Burger"
                className={`hero-food-image hero-food-image-left ${heroImageIndex === 0 ? 'is-active' : ''}`}
              />
              <img
                src={tacosImage}
                alt="Tacos"
                className={`hero-food-image hero-food-image-right ${heroImageIndex === 1 ? 'is-active' : ''}`}
              />
              <img
                src={colaImage}
                alt="Cola"
                className={`hero-food-image hero-food-image-left ${heroImageIndex === 2 ? 'is-active' : ''}`}
                style={{ width: 'min(240px, 22vw)' }}
              />
              <img
                src={livreurImage}
                alt="Livreur"
                className={`hero-food-image hero-food-image-right ${heroImageIndex === 3 ? 'is-active' : ''}`}
              />
              <img
                src={pharmacieImage}
                alt="Pharmacie"
                className={`hero-food-image hero-food-image-left ${heroImageIndex === 4 ? 'is-active' : ''}`}
              />
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div style={{
          position: 'absolute',
          bottom: '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'bounce 2s infinite'
        }}>
          <ChevronRight size={30} color={gold} style={{ transform: 'rotate(90deg)' }} />
        </div>
      </section>

      {/* Restaurants Preview */}
      <section style={{ padding: '100px 5%', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '60px' }}>
          Meilleurs restaurants et plus
        </h2>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '40px',
          flexWrap: 'wrap',
          minHeight: '200px'
        }}>
          {(randomStores.length > 0 ? randomStores : [1, 2, 3, 4, 5, 6, 7, 8]).map((store, i) => (
            <div 
              key={typeof store === 'object' ? store.id : i} 
              className="store-item-fade"
              style={{ textAlign: 'center', width: '120px' }}
            >
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                backgroundColor: '#111',
                border: `2px solid ${gold}33`,
                overflow: 'hidden',
                marginBottom: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                boxShadow: `0 10px 20px rgba(0,0,0,0.3)`
              }}
              onClick={() => typeof store === 'object' && openStartModal()}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = gold;
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${gold}33`;
                e.currentTarget.style.transform = 'scale(1)';
              }}
              >
                {typeof store === 'object' && store.image ? (
                  <img src={store.image} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <StoreIcon size={40} color={gold} opacity={0.5} />

                )}
              </div>
              <p style={{ fontWeight: '700', fontSize: '0.9rem', color: white, margin: 0, lineClamp: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {typeof store === 'object' ? store.name : `Restaurant ${i + 1}`}
              </p>
            </div>
          ))}
        </div>


      </section>

      {/* Features Section */}
      <section style={{ padding: '100px 5%', backgroundColor: '#050505' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '40px'
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: '40px',
              backgroundColor: '#111',
              borderRadius: '30px',
              border: `1px solid ${gold}11`,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = gold}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = `${gold}11`}
            >
              <div style={{ marginBottom: '20px' }}>{f.icon}</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '15px', color: gold }}>{f.title}</h3>
              <p style={{ color: '#888', lineHeight: '1.6' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories Section */}
      <section style={{ padding: '100px 5%', textAlign: 'center', backgroundColor: '#050505' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '60px' }}>
          Catégories populaires
        </h2>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          {categories.map((cat, i) => (
            <button key={i} style={{
              padding: '12px 30px',
              backgroundColor: `${gold}11`,
              color: gold,
              border: `1px solid ${gold}33`,
              borderRadius: '30px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = gold;
              e.currentTarget.style.color = black;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = `${gold}11`;
              e.currentTarget.style.color = gold;
            }}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Opportunities Section */}
      <section style={{ padding: '100px 5%' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px'
        }}>
          {[
            { title: "Devenir coursier", icon: <Truck size={32} />, color: "#4CAF50" },
            { title: "Devenir partenaire", icon: <Handshake size={32} />, color: "#2196F3" },
            { title: "Emploi", icon: <Briefcase size={32} />, color: "#FFC107" }
          ].map((op, i) => (
            <div key={i} style={{
              height: '240px',
              backgroundColor: '#111',
              borderRadius: '30px',
              padding: '40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              border: `1px solid ${gold}11`,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-10px)';
              e.currentTarget.style.borderColor = gold;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = `${gold}11`;
            }}
            >
              <div style={{ 
                width: '70px', 
                height: '70px', 
                borderRadius: '20px', 
                backgroundColor: `${gold}22`, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                marginBottom: '20px',
                color: gold
              }}>
                {op.icon}
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{op.title}</h3>
              <p style={{ color: gold, marginTop: '10px', fontWeight: '700' }}>En savoir plus <ChevronRight size={16} style={{ display: 'inline-block', verticalAlign: 'middle' }} /></p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works Section - SEO rich content */}
      <section style={{ padding: '100px 5%', backgroundColor: '#050505', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '20px' }}>
          Comment ça marche ?
        </h2>
        <p style={{ color: '#888', maxWidth: '700px', margin: '0 auto 60px', lineHeight: '1.8', fontSize: '1.1rem' }}>
          Commander sur Veetaa est simple et rapide. Notre plateforme de livraison à domicile à Kenitra
          vous permet de recevoir tout ce dont vous avez besoin en seulement trois étapes.
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '40px',
          textAlign: 'center'
        }}>
          {[
            { step: '1', title: 'Choisissez votre ville', desc: 'Sélectionnez Kenitra ou votre zone de livraison parmi nos villes disponibles au Maroc. Veetaa couvre de plus en plus de villes pour vous servir au mieux.' },
            { step: '2', title: 'Parcourez et commandez', desc: 'Explorez les restaurants, supermarchés, pharmacies, boulangeries et pressings partenaires. Ajoutez vos articles au panier et validez votre commande en ligne facilement.' },
            { step: '3', title: 'Livraison express à domicile', desc: 'Un coursier Veetaa récupère votre commande et vous la livre rapidement chez vous. Suivez votre livraison en temps réel sur notre application.' }
          ].map((item, i) => (
            <div key={i} style={{
              padding: '40px 30px',
              backgroundColor: '#111',
              borderRadius: '30px',
              border: `1px solid ${gold}11`
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: `${gold}22`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '1.5rem',
                fontWeight: '900',
                color: gold
              }}>
                {item.step}
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '15px', color: gold }}>{item.title}</h3>
              <p style={{ color: '#888', lineHeight: '1.7' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SEO Content Section */}
      <section style={{ padding: '80px 5%', backgroundColor: '#000' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '30px', color: gold, textAlign: 'center' }}>
            Veetaa — Votre service de livraison à Kenitra, Maroc
          </h2>
          <div style={{ color: '#999', lineHeight: '1.9', fontSize: '1rem' }}>
            <p style={{ marginBottom: '20px' }}>
              Veetaa est la plateforme de livraison à domicile numéro un à Kenitra, au Maroc. Nous connectons
              les habitants de Kenitra avec les meilleurs restaurants, supermarchés, pharmacies, boulangeries
              et commerces de proximité de la ville. Que vous souhaitiez commander un repas chaud, faire vos
              courses alimentaires en ligne, recevoir vos médicaments de pharmacie ou votre pain frais de
              boulangerie, Veetaa est là pour vous.
            </p>
            <p style={{ marginBottom: '20px' }}>
              Notre réseau de coursiers professionnels assure une livraison rapide et fiable partout à Kenitra
              et dans ses environs. Grâce à notre application de livraison intuitive, vous pouvez passer
              commande en quelques clics, suivre votre colis en temps réel et recevoir vos achats directement
              chez vous. Service de livraison express disponible 7 jours sur 7.
            </p>
            <p>
              Veetaa propose également des opportunités d'emploi pour les coursiers et les partenaires
              commerciaux à Kenitra. Rejoignez notre communauté grandissante de restaurants, épiceries et
              commerces partenaires. Ensemble, nous transformons la livraison à domicile au Maroc.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '80px 5% 40px', borderTop: `1px solid ${gold}33`, backgroundColor: '#020202' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '60px',
          marginBottom: '80px'
        }}>
          <div>
            <img src="/logo.png" alt="Veetaa livraison rapide Kenitra Maroc" style={{ height: '50px', marginBottom: '15px' }} />
            <p style={{ color: '#666', fontSize: '0.85rem', lineHeight: '1.7', marginBottom: '20px', maxWidth: '280px' }}>
              Veetaa — Service de livraison rapide à Kenitra. Restauration, courses alimentaires, pharmacie,
              boulangerie et pressing livrés à domicile.
            </p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <Instagram size={24} color={gold} />
              <Facebook size={24} color={gold} />
              <Twitter size={24} color={gold} />
            </div>
          </div>
          <div>
            <h4 style={{ color: gold, marginBottom: '25px', fontWeight: '800' }}>Entreprise</h4>
            <ul style={{ listStyle: 'none', padding: 0, color: '#888', lineHeight: '2' }}>
              <li>À propos</li>
              <li>Carrières</li>
              <li>Blog</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: gold, marginBottom: '25px', fontWeight: '800' }}>Aide</h4>
            <ul style={{ listStyle: 'none', padding: 0, color: '#888', lineHeight: '2' }}>
              <li>Support</li>
              <li>FAQ</li>
              <li>Sécurité</li>
            </ul>
          </div>
          <div>
            <h4 style={{ color: gold, marginBottom: '25px', fontWeight: '800' }}>Légal</h4>
            <ul style={{ listStyle: 'none', padding: 0, color: '#888', lineHeight: '2' }}>
              <li>Conditions d'utilisation</li>
              <li>Confidentialité</li>
              <li>Cookies</li>
            </ul>
          </div>
        </div>
        <div style={{ textAlign: 'center', color: '#555', fontSize: '0.8rem', paddingTop: '40px', borderTop: '1px solid #111' }}>
          © {new Date().getFullYear()} Veetaa. Tous droits réservés.
        </div>
      </footer>

      <style>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {transform: translateX(-50%) translateY(0);}
          40% {transform: translateX(-50%) translateY(-10px);}
          60% {transform: translateX(-50%) translateY(-5px);}
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sloganReveal {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes foodFloatZoom {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.04); }
        }
        @keyframes foodGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.2)); }
          50% { filter: drop-shadow(0 0 24px rgba(212, 175, 55, 0.5)); }
        }
        @keyframes sloganGlow {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(212, 175, 55, 0)); }
          50% { filter: drop-shadow(0 0 24px rgba(212, 175, 55, 0.5)); }
        }
        .store-item-fade {
          animation: fadeInScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hero-slogan-line {
          display: inline-block;
          background: linear-gradient(135deg, #FFFFFF 0%, #D4AF37 50%, #B8860B 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation:
            sloganReveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards,
            sloganGlow 3s ease-in-out infinite;
          will-change: transform, opacity, filter;
          min-height: 1.2em;
          white-space: normal;
          text-align: center;
          max-width: 100%;
        }
        .hero-main-layout {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 48px;
          width: 100%;
        }
        .hero-text-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 0;
          flex: 1;
          max-width: 720px;
        }
        .hero-images-frame {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: min(460px, 42vw);
          height: min(300px, 30vw);
          min-width: 340px;
          min-height: 230px;
          padding: 0;
          overflow: visible;
        }
        .hero-food-image {
          position: absolute;
          width: min(300px, 27vw);
          height: auto;
          margin: 0;
          display: block;
          opacity: 0;
          transform: translateY(10px) scale(0.94);
          animation:
            foodFloatZoom 3.6s ease-in-out infinite,
            foodGlow 3.6s ease-in-out infinite;
          transition: opacity 0.55s ease, transform 0.55s ease;
          will-change: transform, filter;
          pointer-events: none;
        }
        .hero-food-image.is-active {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .hero-food-image-left {
          animation-delay: 0.2s;
        }
        .hero-food-image-right {
          animation-delay: 1s;
        }
        @media (max-width: 960px) {
          .hero-main-layout {
            flex-direction: column;
            gap: 24px;
          }
          .hero-text-block {
            max-width: 100%;
          }
          .hero-images-frame {
            width: min(360px, 86vw);
            height: min(260px, 62vw);
            min-width: auto;
            min-height: auto;
          }
          .hero-food-image {
            width: min(240px, 58vw);
          }
        }
        .start-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 16px;
        }
        .start-modal-card {
          width: min(540px, 92vw);
          border-radius: 24px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          background: linear-gradient(165deg, #121212 0%, #080808 100%);
          padding: 22px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 30px rgba(212, 175, 55, 0.16);
        }
        .start-modal-title {
          margin: 0 0 14px;
          font-size: clamp(1.1rem, 2.8vw, 1.5rem);
          font-weight: 900;
          color: #fff;
        }
        .start-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 14px;
        }
        .start-modal-btn {
          border: none;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .start-modal-btn-primary {
          background: #d4af37;
          color: #000;
        }
        .start-modal-btn-secondary {
          background: rgba(212, 175, 55, 0.12);
          color: #f3d97a;
          border: 1px solid rgba(212, 175, 55, 0.35);
        }
        .start-modal-input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(212, 175, 55, 0.35);
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
          padding: 10px 12px;
          outline: none;
          margin-bottom: 10px;
        }
        .start-modal-city-list {
          max-height: 220px;
          overflow: auto;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
        }
        .start-modal-city-item {
          width: 100%;
          text-align: left;
          border: none;
          padding: 10px 12px;
          color: #f5f5f5;
          background: transparent;
          cursor: pointer;
        }
        .start-modal-city-item:hover,
        .start-modal-city-item.active {
          background: rgba(212, 175, 55, 0.18);
          color: #fff;
        }
        .start-modal-hint {
          color: #bbbbbb;
          font-size: 0.9rem;
          margin: 8px 0 0;
        }
        .start-modal-error {
          color: #ff7a7a;
          font-size: 0.9rem;
          margin-top: 8px;
        }
        @media (max-width: 640px) {
          .start-modal-actions {
            grid-template-columns: 1fr;
          }
        }
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');
      `}</style>

      {showStartModal && (
        <div className="start-modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="start-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="start-modal-title">
              {language === 'en'
                ? 'How do you want to browse stores?'
                : 'Comment voulez-vous afficher les magasins ?'}
            </h3>
            <p className="start-modal-hint">
              {language === 'en'
                ? 'Choose a city from available zones or use your current location.'
                : 'Choisissez une ville disponible en base ou utilisez votre localisation actuelle.'}
            </p>

            <input
              className="start-modal-input"
              value={citySearch}
              onChange={(e) => setCitySearch(sanitizeSearchInput(e.target.value))}
              placeholder={language === 'en' ? 'Search city...' : 'Rechercher une ville...'}
            />

            <div className="start-modal-city-list">
              {filteredCities.length === 0 ? (
                <p className="start-modal-hint" style={{ padding: '10px 12px' }}>
                  {language === 'en' ? 'No city found.' : 'Aucune ville trouvee.'}
                </p>
              ) : (
                filteredCities.map((city: any) => (
                  <button
                    key={city.name}
                    className={`start-modal-city-item ${selectedCityName === city.name ? 'active' : ''}`}
                    onClick={() => setSelectedCityName(city.name)}
                  >
                    {city.name}
                  </button>
                ))
              )}
            </div>

            {startError && <p className="start-modal-error">{startError}</p>}

            <div className="start-modal-actions">
              <button className="start-modal-btn start-modal-btn-secondary" onClick={handleChooseCity}>
                {language === 'en' ? 'Choose this city' : 'Choisir cette ville'}
              </button>
              <button
                className="start-modal-btn start-modal-btn-primary"
                onClick={handleUseLocation}
                disabled={loadingLocation}
              >
                {loadingLocation
                  ? (language === 'en' ? 'Locating...' : 'Localisation...')
                  : (language === 'en' ? 'Use my location' : 'Utiliser ma localisation')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPage;
