"use client";

import { Search, TrendingUp, Shield, Award } from "lucide-react";

export function HeroSection() {
  return (
    <section id="inicio" className="relative pt-24 pb-16 md:pt-32 md:pb-24 bg-gradient-to-br from-primary-50 via-white to-primary-50">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6">
            <div className="inline-block">
              <span className="bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold">
                🏆 Expertos en Bienes Raíces
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Encuentra tu
              <span className="text-primary-600"> propiedad ideal</span>
            </h1>
            
            <p className="text-lg text-gray-600">
              Más de 20 años ayudando a nuestros clientes a encontrar, invertir y rentabilizar 
              propiedades. Tu sueño, nuestra misión.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="#propiedades"
                className="bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Search className="h-5 w-5" />
                <span>Ver Propiedades</span>
              </a>
              <a
                href="#contacto"
                className="border-2 border-primary-600 text-primary-600 px-8 py-4 rounded-lg font-semibold hover:bg-primary-50 transition-colors flex items-center justify-center"
              >
                Contactar Agente
              </a>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">500+</div>
                <div className="text-sm text-gray-600">Propiedades</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">1,200+</div>
                <div className="text-sm text-gray-600">Clientes Felices</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary-600">20+</div>
                <div className="text-sm text-gray-600">Años</div>
              </div>
            </div>
          </div>

          {/* Right Content - Image/Features */}
          <div className="relative">
            <div className="bg-primary-600 rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800"
                alt="Propiedad destacada"
                className="w-full h-[400px] md:h-[500px] object-cover"
              />
            </div>
            
            {/* Floating Cards */}
            <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl hidden md:block">
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-3 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">+25%</div>
                  <div className="text-sm text-gray-600">ROI Promedio</div>
                </div>
              </div>
            </div>

            <div className="absolute -top-6 -right-6 bg-white p-4 rounded-xl shadow-xl hidden md:block">
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">100%</div>
                  <div className="text-sm text-gray-600">Seguro</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-1/4 left-0 w-64 h-64 bg-primary-200 rounded-full filter blur-3xl opacity-20 -z-10"></div>
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-primary-300 rounded-full filter blur-3xl opacity-20 -z-10"></div>
    </section>
  );
}
