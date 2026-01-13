import React, { createContext, useState, useContext, useMemo, useEffect, useCallback } from 'react';

const translations = {
  // General
  'Back to': { en: 'Back to', nl: 'Terug naar' },
  'Preview': { en: 'Preview', nl: 'Voorbeeld' },
  'Save Draft': { en: 'Save Draft', nl: 'Concept Opslaan' },
  'Saving...': { en: 'Saving...', nl: 'Opslaan...' },
  'Save & Send': { en: 'Save & Send', nl: 'Opslaan & Versturen' },
  'Sending...': { en: 'Sending...', nl: 'Versturen...' },
  'Loading...': { en: 'Loading...', nl: 'Laden...' },
  'Edit': { en: 'Edit', nl: 'Bewerken' },
  'Cancel': { en: 'Cancel', nl: 'Annuleren' },
  'Confirm': { en: 'Confirm', nl: 'Bevestigen' },
  'Close': { en: 'Close', nl: 'Sluiten' },
  'N/A': { en: 'N/A', nl: 'N.v.t.' },
  'Yes': { en: 'Yes', nl: 'Ja' },
  'No': { en: 'No', nl: 'Nee' },
  'Description': { en: 'Description', nl: 'Omschrijving' },
  'Status': { en: 'Status', nl: 'Status' },
  'Actions': { en: 'Actions', nl: 'Acties' },
  'Notes': { en: 'Notes', nl: 'Notities' },
  'Search': { en: 'Search', nl: 'Zoeken' },
  'All': { en: 'All', nl: 'Alles' },
  'from': { en: 'from', nl: 'van' },
  'Signed': { en: 'Signed', nl: 'Ondertekend' },

  // Layout & Sidebar
  'Dashboard': { en: 'Dashboard', nl: 'Dashboard' },
  'Products': { en: 'Products', nl: 'Producten' },
  'Offers': { en: 'Offers', nl: 'Offertes' },
  'Projects': { en: 'Projects', nl: 'Projecten' },
  'Taken': { en: 'Tasks', nl: 'Taken' },
  'Resources': { en: 'Resources', nl: 'Resources' },
  'Clients': { en: 'Clients', nl: 'Klanten' },
  'Analytics': { en: 'Analytics', nl: 'Analyse' },
  'Main Menu': { en: 'Main Menu', nl: 'Hoofdmenu' },
  'Quick Access': { en: 'Quick Access', nl: 'Snelle Toegang' },
  'Draft Offers': { en: 'Draft Offers', nl: 'Conceptoffertes' },
  'Active Projects': { en: 'Active Projects', nl: 'Actieve Projecten' },
  'This Week': { en: 'This Week', nl: 'Deze Week' },
  'Management Platform': { en: 'Festival platform', nl: 'Festival platform' },
  'Dutch': { en: 'Dutch', nl: 'Nederlands' },
  'English': { en: 'English', nl: 'Engels' },
  'Language': { en: 'Language', nl: 'Taal' },

  // Add new translations for account section
  'Account Settings': { en: 'Account Settings', nl: 'Accountinstellingen' },
  'Sign Out': { en: 'Sign Out', nl: 'Uitloggen' },
  
  // Dashboard Page
  'Business Overview': { en: 'Business Overview', nl: 'Bedrijfsoverzicht' },
  'Monitor your festival services operations': { en: 'Monitor your festival services operations', nl: 'Monitor de operationele activiteiten van je festivaldiensten' },
  'New Offer': { en: 'New Offer', nl: 'Nieuwe Offerte' },
  'Add Client': { en: 'Add Client', nl: 'Klant Toevoegen' },
  'Add Product': { en: 'Add Product', nl: 'Product Toevoegen' },
  'Search product...': { en: 'Search product...', nl: 'Zoek product...' },
  'No product found.': { en: 'Geen product gevonden.', nl: 'Geen product gevonden.' },
  'Total Clients': { en: 'Total Clients', nl: 'Totaal Klanten' },
  'this quarter': { en: 'this quarter', nl: 'dit kwartaal' },
  'Catalog ready': { en: 'Catalog ready', nl: 'Catalogus gereed' },
  'Pending Offers': { en: 'Pending Offers', nl: 'Openstaande Offertes' },
  'Awaiting response': { en: 'Awaiting response', nl: 'Wachten op reactie' },
  'In progress': { en: 'In progress', nl: 'In uitvoering' },
  'Monthly Revenue': { en: 'Monthly Revenue', nl: 'Maandelijkse Omzet' },
  'vs last month': { en: 'vs last month', nl: 'vs vorige maand' },
  'Avg. Margin': { en: 'Avg. Margin', nl: 'Gem. Marge' },
  'Above target': { en: 'Above target', nl: 'Boven doelstelling' },
  'Recent Offers': { en: 'Recent Offers', nl: 'Recente Offertes' },
  'View All': { en: 'View All', nl: 'Bekijk Alles' },
  'No offers created yet': { en: 'No offers created yet', nl: 'Nog geen offertes aangemaakt' },
  'Create Your First Offer': { en: 'Create Your First Offer', nl: 'Maak je eerste offerte' },
  'incl. BTW': { en: 'incl. BTW', nl: 'incl. BTW' },
  'Resource Overview': { en: 'Resource Overzicht', nl: 'Resource Overzicht' },
  'Hardware allocation for upcoming events': { en: 'Hardware allocation for upcoming events', nl: 'Hardware toewijzing voor komende evenementen' },

  // Add new translations for dashboard
  'Open Offers': { en: 'Open Offers', nl: 'Openstaande Offertes' },
  'Confirmed Projects': { en: 'Confirmed Projects', nl: 'Bevestigde Projecten' },
  'Revenue Overview': { en: 'Revenue Overview', nl: 'Omzet Overzicht' },
  'Potential': { en: 'Potential', nl: 'Potentieel' },
  'Total Open + Confirmed': { en: 'Total Open + Confirmed', nl: 'Totaal Open + Bevestigd' },
  'Filter by date': { en: 'Filter by date', nl: 'Filter op datum' },
  'All Time': { en: 'All Time', nl: 'Alle Tijd' },
  'Next 3 Months': { en: 'Next 3 Months', nl: 'Komende 3 Maanden' },
  'Next 6 Months': { en: 'Next 6 Months', nl: 'Komende 6 Maanden' },
  'Next 12 Months': { en: 'Next 12 Months', nl: 'Komende 12 Maanden' },
  'Next Year': { en: 'Next Year', nl: 'Komend Jaar' },
  'Past 6 Months': { en: 'Past 6 Months', nl: 'Afgelopen 6 Maanden' },
  'Past 12 Months': { en: 'Past 12 Months', nl: 'Afgelopen 12 Maanden' },
  'Upcoming Projects': { en: 'Upcoming Projects', nl: 'Komende Projecten' },

  'Confirmed Profit': { en: 'Confirmed Profit', nl: 'Bevestigde Winst' },
  'Total Profit Pipeline': { en: 'Total Profit Pipeline', nl: 'Totale Winst Pipeline' },

  'Years': { en: 'Years', nl: 'Jaren' },
  'All Years': { en: 'All Years', nl: 'Alle Jaren' },
  'Filter by Year': { en: 'Filter by Year', nl: 'Filter op Jaar' },
  'Clear All': { en: 'Clear All', nl: 'Wis Alles' },
  'selected': { en: 'selected', nl: 'geselecteerd' },
  'All Periods': { en: 'All Periods', nl: 'Alle Periodes' },
  'Quarters': { en: 'Quarters', nl: 'Kwartalen' },
  'Weeks': { en: 'Weeks', nl: 'Weken' },

  // Products Page
  'Product Name': { en: 'Product Name', nl: 'Productnaam' },
  'Default Price': { en: 'Default Price', nl: 'Standaardprijs' },
  'Unit Type': { en: 'Unit Type', nl: 'Eenheid' },
  '% Fee': { en: 'Fee', nl: 'Procentuele vergoeding' },
  'Cost Basis': { en: 'Cost Basis', nl: 'Kostprijs' },
  '% Cost Basis': { en: '% Cost Basis', nl: 'Procentuele kostprijs' },
  'Active': { en: 'Active', nl: 'Actief' },
  'Hardware Rentals': { en: 'Hardware Verhuur', nl: 'Hardware Verhuur' },
  'Services': { en: 'Services', nl: 'Diensten' },
  'Software': { en: 'Software', nl: 'Software' },
  'Transaction Processing': { en: 'Transaction Processing', nl: 'Transactieverwerking via kassa' },
  'Closed loop materials': { en: 'Closed loop materials', nl: 'Gesloten kringloopmaterialen' },
  'Ticketing & ecommerce fees': { en: 'Ticketing & e-commerce kosten', nl: 'Ticketing & e-commerce kosten' },
  'Festival App': { en: 'Festival App', nl: 'Festival App' },
  'Fees aan bezoeker gerekend': { en: 'Visitor Fees', nl: 'Fees aan bezoeker gerekend' },
  'Per Piece': { en: 'Per Piece', nl: 'Per Stuk' },
  'Per Day': { en: 'Per Day', nl: 'Per Dag' },
  'Per Week': { en: 'Per Week', nl: 'Per Week' },
  'Per Month': { en: 'Per Month', nl: 'Per Maand' },
  'Per Hour': { en: 'Per Hour', nl: 'Per Uur' },
  'Percentage': { en: 'Percentage', nl: 'Percentage' },
  'Transaction': { en: 'Transaction', nl: 'Transactie' },
  'Per Transaction': { en: 'Per Transaction', nl: 'Per Transactie' },
  'Euro Amount': { en: 'Euro Amount', nl: 'Eurobedrag' },
  'Percentage of Revenue': { en: 'Percentage of Revenue', nl: 'Percentage van Omzet' },
  'Post-Event Calculation': { en: 'Post-Event Calculation', nl: 'Nacalculatie' },
  'products': { en: 'products', nl: 'producten' },
  'Add': { en: 'Add', nl: 'Voeg toe' },
  'Product': { en: 'Product', nl: 'Product' },
  'Archive Product': { en: 'Archive Product', nl: 'Archiveer Product' },
  'Are you sure you want to archive': { en: 'Are you sure you want to archive', nl: 'Weet u zeker dat u wilt archiveren' },
  'This will make it inactive and it cannot be added to new offers.': { en: 'This will make it inactive and it cannot be added to new offers.', nl: 'Dit maakt het inactief en kan niet aan nieuwe offertes worden toegevoegd.' },
  'Confirm Archive': { en: 'Confirm Archive', nl: 'Bevestig Archivering' },
  
  'Key Figure': { en: 'Key Figure', nl: 'Kencijfer' },
  'Multiplier': { en: 'Multiplier', nl: 'Vermenigvuldiger' },
  'None': { en: 'None', nl: 'Geen' },
  'Total Visitors': { en: 'Total Visitors', nl: 'Totaal Aantal Bezoekers' },
  'Bar Meters': { en: 'Bar Meters', nl: 'Bar Meters' },
  'Food Sales Positions': { en: 'Food Sales Positions', nl: 'Food Sales Posities' },
  'Euro Spend per Person': { en: 'Euro Spend per Person', nl: 'Euro Besteding per Persoon' },
  'Default Value': { en: 'Default Value', nl: 'Standaardwaarde' },
  'Number of Showdates': { en: 'Number of Showdates', nl: 'Aantal Showdagen' },
  'Expected Revenue': { en: 'Expected Revenue', nl: 'Verwachte Omzet' },

  // Add Hardware Group Filter to Products
  'Hardware Group': { en: 'Hardware Group', nl: 'Hardwaregroep' },
  'Workstation': { en: 'Workstation', nl: 'Workstation' },
  'Handheld': { en: 'Handheld', nl: 'Handheld' },
  'Cashpoint': { en: 'Cashpoint', nl: 'Cashpoint' },
  'Bonnenprinter': { en: 'Bonnenprinter', nl: 'Bonnenprinter' },
  
  // Add Staffel to Products
  'Staffel': { en: 'Staffel', nl: 'Staffel' },

  // Clients Page
  'Client Management': { en: 'Client Management', nl: 'Klantenbeheer' },
  'Manage your festival clients and contacts': { en: 'Manage your festival clients and contacts', nl: 'Beheer uw festivalklanten en contacten' },
  'Search clients...': { en: 'Search clients...', nl: 'Zoek klanten...' },
  'Company': { en: 'Company', nl: 'Bedrijf' },
  'Contact': { en: 'Contactpersoon', nl: 'Contactpersoon' },
  'Email': { en: 'E-mail', nl: 'E-mail' },
  'Phone': { en: 'Phone', nl: 'Telefoon' },
  'Edit Client': { en: 'Edit Client', nl: 'Klant Bewerken' },
  'Add New Client': { en: 'New Client', nl: 'Nieuwe Klant Toevoegen' },
  'Company Name': { en: 'Company Name', nl: 'Bedrijfsnaam' },
  'Festival Organization Name': { en: 'Festival Organization Name', nl: 'Naam Festivalorganisatie' },
  'Contact Person': { en: 'Contact Person', nl: 'Contactpersoon' },
  'Primary contact name': { en: 'Primary contact name', nl: 'Naam hoofdcontactpersoon' },
  'Address': { en: 'Address', nl: 'Adres' },
  'Complete address': { en: 'Complete address', nl: 'Volledig adres' },
  'BTW/VAT Number': { en: 'BTW/VAT Number', nl: 'BTW-nummer' },
  'Additional information about the client': { en: 'Additional information about the client', nl: 'Aanvullende informatie over de klant' },
  'Create Client': { en: 'Create Client', nl: 'Klant Aanmaken' },
  'Update Client': { en: 'Update Client', nl: 'Klant Bijwerken' },
  'No clients found.': { en: 'Geen klanten gevonden.', nl: 'Geen klanten gevonden.' },
  'Comprehensive client relationship management': { en: 'Comprehensive client relationship management', nl: 'Uitgebreid klantrelatiebeheersysteem' },
  'Primary Contact': { en: 'Primary Contact', nl: 'Primair Contact' },
  'Contact Info': { en: 'Contact Info', nl: 'Contactgegevens' },
  'Total Revenue': { en: 'Total Revenue', nl: 'Totale Omzet' },
  'Total Profit': { en: 'Total Profit', nl: 'Totale Winst' },
  'Avg Margin': { en: 'Avg Margin', nl: 'Gem. Marge' },
  'Last Project': { en: 'Last Project', nl: 'Laatste Project' },
  'more': { en: 'more', nl: 'meer' },
  'Overview': { en: 'Overview', nl: 'Overzicht' },
  'Contacts': { en: 'Contacts', nl: 'Contacten' },
  'Company Information': { en: 'Company Information', nl: 'Bedrijfsinformatie' },
  'Website': { en: 'Website', nl: 'Website' },
  'Client Since': { en: 'Client Since', nl: 'Klant Sinds' },
  'Financial Summary': { en: 'Financial Summary', nl: 'Financieel Overzicht' },
  'Average Margin': { en: 'Average Margin', nl: 'Gemiddelde Marge' },
  'Additional Contacts': { en: 'Additional Contacts', nl: 'Aanvullende Contacten' },
  'Add New Contact': { en: 'New Contact', nl: 'Nieuw Contact Toevoegen' },
  'Role': { en: 'Rol', nl: 'Rol' },
  'Add Contact': { en: 'Add Contact', nl: 'Contact Toevoegen' },
  'No additional contacts added yet': { en: 'No additional contacts added yet', nl: 'Nog geen aanvullende contacten toegevoegd' },
  'No projects yet': { en: 'No projects yet', nl: 'Nog geen projecten' },
  'Projects will appear here once offers are accepted': { en: 'Projects will appear here once offers are accepted', nl: 'Projecten verschijnen hier zodra offertes zijn geaccepteerd' },
  'Visitors': { en: 'Visitors', nl: 'Bezoekers' },
  'No offers yet': { en: 'No offers yet', nl: 'Nog geen offertes' },
  'Offer #': { en: 'Offer #', nl: 'Offerte #' },
  'Created': { en: 'Created', nl: 'Aangemaakt' },

  // Add Potential Revenue Breakdown in Client Overview
  'Potential Revenue': { en: 'Potential Revenue', nl: 'Potentiële Omzet' },
  'open offers': { en: 'open offers', nl: 'openstaande offertes' },
  'Confirmed Revenue': { en: 'Confirmed Revenue', nl: 'Bevestigde Omzet' },
  'signed offers': { en: 'signed offers', nl: 'ondertekende offertes' },
  'Project Revenue (Realized)': { en: 'Project Revenue (Realized)', nl: 'Project Omzet (Gerealiseerd)' },
  // Add new translations
  'Signed Offers': { en: 'Signed Offers', nl: 'Getekende Offertes' },
  
  // Client Offer Portal
  'View Client Page': { en: 'View Client Page', nl: 'Bekijk Klantpagina' },
  'Copy Link': { en: 'Copy Link', nl: 'Kopieer Link' },
  'Link copied to clipboard!': { en: 'Link copied to clipboard!', nl: 'Link gekopieerd!' },
  'Duplicate': { en: 'Duplicate', nl: 'Dupliceer' },
  'Offer duplicated!': { en: 'Offer duplicated!', nl: 'Offerte gedupliceerd!' },
  'Failed to duplicate offer.': { en: 'Failed to duplicate offer.', nl: 'Offerte dupliceren mislukt.' },

  // Offers Page
  'Create, manage, and track festival service offers': { en: 'Create, manage, and track festival service offers', nl: 'Maak, beheer en volg offertes voor festivaldiensten' },
  'All Statuses': { en: 'All Statussen', nl: 'Alle Statussen' },
  'All Clients': { en: 'All Clients', nl: 'Alle Klanten' },
  'Filter by status': { en: 'Filter by status', nl: 'Filter op status' },
  'Filter by client': { en: 'Filter by client', nl: 'Filter op klant' },
  'Search offers...': { en: 'Search offers...', nl: 'Zoek offertes...' },
  'Project Created': { en: 'Project Created', nl: 'Project Aangemaakt' },
  'Create Project': { en: 'Create Project', nl: 'Project Aanmaken' },
  'Creating...': { en: 'Creating...', nl: 'Aanmaken...' },
  'Updated': { en: 'Bijgewerkt', nl: 'Bijgewerkt' },
  'Valid until': { en: 'Valid until', nl: 'Geldig tot' },
  'No offers match your filters': { en: 'Geen offertes gevonden met deze filters', nl: 'Geen offertes gevonden met deze filters' },
  'Try adjusting your search or create a new offer.': { en: 'Try adjusting your search or create a new offer.', nl: 'Pas uw zoekopdracht aan of maak een nieuwe offerte.' },
  'Create Offer': { en: 'Create Offer', nl: 'Offerte Maken' },

  'Archived': { en: 'Archived', nl: 'Gearchiveerd' },
  'No active offers': { en: 'No active offers', nl: 'Geen actieve offertes' },
  'No archived offers': { en: 'No archived offers', nl: 'Geen gearchiveerde offertes' },

  'Reset to Draft': { en: 'Reset to Draft', nl: 'Reset naar Concept' },
  'Reset Signed Offer?': { en: 'Reset Signed Offer?', nl: 'Getekende Offerte Resetten?' },
  'This will remove the signature and reset the offer to draft status. The associated project will remain unchanged.': {
    en: 'This will remove the signature and reset the offer to draft status. The associated project will remain unchanged.',
    nl: 'Dit zal de handtekening verwijderen en de offerte terugzetten naar concept status. Het gekoppelde project blijft ongewijzigd.'
  },
  'Offer reset to draft': { en: 'Offer reset to draft', nl: 'Offerte teruggezet naar concept' },
  'Failed to reset offer': { en: 'Failed to reset offer', nl: 'Offerte resetten mislukt' },

  // Add Show Archived Offers with Restore Functionality
  'Show Archived': { en: 'Show Archived', nl: 'Toon Gearchiveerd' },
  'Show Active': { en: 'Show Active', nl: 'Toon Actief' },
  'Archived Offers': { en: 'Archived Offers', nl: 'Gearchiveerde Offertes' },
  'Restore to Draft': { en: 'Restore to Draft', nl: 'Herstel naar Concept' },
  'Offer restored to draft.': { en: 'Offer restored to draft.', nl: 'Offerte hersteld naar concept.' },
  'Failed to restore offer.': { en: 'Failed to restore offer.', nl: 'Offerte herstellen mislukt.' },

  // Offer Editor & Footer
  'Offerte': { en: 'Offerte', nl: 'Offerte' },
  'Offer': { en: 'Offer', nl: 'Offerte' },
  'Client:': { en: 'Client:', nl: 'Klant:' },
  'Opdrachtgever:': { en: 'Client:', nl: 'Opdrachtgever:' },
  'Select Client': { en: 'Selecteer Klant', nl: 'Selecteer Klant' },
  'Offer #:': { en: 'Offer #:', nl: 'Offertennr:' },
  'Contact:': { en: 'Contact:', nl: 'Contact:' },
  'Date:': { en: 'Date:', nl: 'Datum:' },
  'Project:': { en: 'Project:' },
  'Project Name': { en: 'Project Name', nl: 'Projectnaam' },
  'Enter project name': { en: 'Enter project name', nl: 'Voer projectnaam in' },
  'Valid Until:': { en: 'Valid Until:', nl: 'Geldig tot:' },
  'Location:': { en: 'Location', nl: 'Locatie' },
  'Enter project location': { en: 'Enter project location', nl: 'Voer projectlocatie in' },
  'Project Location': { en: 'Project Location', nl: 'Projectlocatie' },
  'Event Date:': { en: 'Event Date:', nl: 'Datum Evenement:' },
  'Project Offer': { en: 'Project Offer', nl: 'Projectofferte' },
  'Quantity': { en: 'Quantity', nl: 'Aantal' },
  'Unit Price': { en: 'Unit Price', nl: 'Stukprijs' },
  'Total': { en: 'Totaal', nl: 'Totaal' },
  'No products in this category': { en: 'No products in this category', nl: 'Geen producten in deze categorie' },
  'Aanvullende afspraken over dit project': { en: 'Additional project agreements', nl: 'Aanvullende afspraken over dit project' },
  'Enter additional project agreements...': { en: 'Enter additional project agreements...', nl: 'Voer aanvullende projectafspraken in...' },
  'Subtotal (excl. BTW)': { en: 'Subtotal (excl. BTW)', nl: 'Subtotaal (excl. BTW)' },
  'Discount': { en: 'Discount', nl: 'Korting' },
  'Discount Applied': { en: 'Discount Applied', nl: 'Korting Toegepast' },
  'No additional agreements specified': { en: 'No additional agreements specified', nl: 'Geen aanvullende afspraken gespecificeerd' },
  'Amount': { en: 'Amount', nl: 'Bedrag' },
  'Subtotal (after discount)': { en: 'Subtotal (after discount)', nl: 'Subtotaal (na korting)' },
  'Total (incl. BTW)': { en: 'Total (incl. BTW)', nl: 'Totaal (incl. BTW)' },
  'Post-Event Calculation Items': { en: 'Post-Event Calculation Items', nl: 'Nacalculatie Items' },
  'These items are usage-based and will be billed separately after the event.': { en: 'These items are usage-based and will be billed separately after the event.', nl: 'Deze items zijn op basis van verbruik en worden na het evenement afzonderlijk gefactureerd.' },
  'Prices are excl. VAT': { en: 'Prices are excl. VAT', nl: 'Prijzen zijn exclusief BTW' },
  'Please select a client and enter a project name.': { en: 'Please select a client and enter a project name.', nl: 'Selecteer een klant en voer een projectnaam in.' },
  'Offer sent!': { en: 'Offer sent!', nl: 'Offerte verzonden!' },
  'Offer saved!': { en: 'Offer saved!', nl: 'Offerte opgeslagen!' },
  'Failed to save offer.': { en: 'Failed to save offer.', nl: 'Opslaan van offerte mislukt.' },
  'Loading Offer Editor...': { en: 'Loading Offer Editor...!', nl: 'Offerte-editor laden...!' },
  'Select show dates': { en: 'Select show dates', nl: 'Selecteer showdatums' },
  'Version:': { en: 'Version:', nl: 'Versie:' },
  'Showdates:': { en: 'Showdatums:', nl: 'Showdatums:' },
  'Ticketing Deal': { en: 'Ticketing Deal', nl: 'Ticketing Deal' },

  // Add Discount Category with Negative Line Items
  'Discounts': { en: 'Discounts', nl: 'Korting' },
  
  // Add Profit Forecasting Section
  'Profit Calculator': { en: 'Profit Calculator', nl: 'Winstcalculator' },
  'Profit Analysis': { en: 'Profit Analysis', nl: 'Winstanalyse' },
  'Forecast Revenue': { en: 'Forecast Revenue', nl: 'Prognose Omzet' },
  'Revenue': { en: 'Revenue', nl: 'Omzet' },
  'Cost': { en: 'Cost', nl: 'Kosten' },
  'Profit': { en: 'Profit', nl: 'Winst' },
  'Standard Items': { en: 'Standard Items', nl: 'Standaard Items' },
  'Standard Items Profit': { en: 'Standard Items Profit', nl: 'Standaard Items Winst' },
  'Post-Event Forecast': { en: 'Post-Event Forecast', nl: 'Nacalculatie Prognose' },
  'Post-Event Forecast Profit': { en: 'Post-Event Forecast Profit', nl: 'Nacalculatie Prognose Winst' },
  'Total Profit Forecast': { en: 'Total Profit Forecast', nl: 'Totale Winst Prognose' },
  'Standard Subtotal': { en: 'Standard Subtotal', nl: 'Standaard Subtotaal' },
  'Post-Event Subtotal': { en: 'Post-Event Subtotal', nl: 'Nacalculatie Subtotaal' },
  'Total Profit Summary': { en: 'Total Profit Summary', nl: 'Totale Winst Overzicht' },
  'Total Revenue (excl. BTW)': { en: 'Total Revenue (excl. BTW)', nl: 'Totale Omzet (excl. BTW)' },
  'Total Costs': { en: 'Total Costs', nl: 'Totale Kosten' },
  'Net Profit (excl. BTW)': { en: 'Net Profit (excl. BTW)', nl: 'Netto Winst (excl. BTW)' },
  
  // Offer Review
  'Offer Not Found': { en: 'Offer Not Found', nl: 'Offerte Niet Gevonden' },
  'The requested offer could not be found or may have been removed.': { en: 'De gevraagde offerte kon niet worden gevonden of is mogelijk verwijderd.', nl: 'De gevraagde offerte kon niet worden gevonden of is mogelijk verwijderd.' },
  'Please check your link and try again': { en: 'Please check your link and try again', nl: 'Controleer uw link en probeer het opnieuw' },
  
  // Projects Page
  'Project Management': { en: 'Project Management', nl: 'Projectbeheer' },
  'Comprehensive project overview with inline editing capabilities': { en: 'Comprehensive project overview with inline editing capabilities', nl: 'Uitgebreid projectoverzicht met inline bewerkingsmogelijkheden' },
  'Search projects by name, client, or location...': { en: 'Search projects by name, client, or location...', nl: 'Zoek projecten op naam, klant of locatie...' },
  'Tasks': { en: 'Tasks', nl: 'Taken' },
  'Week': { en: 'Week', nl: 'Week' },
  'Showdates': { en: 'Showdates', nl: 'Showdata' },
  'Client': { en: 'Client', nl: 'Klant' },
  'Location': { en: 'Location', nl: 'Locatie' },
  '€ Offered': { en: '€ Offered', nl: '€ Geoffreerd' },
  '€ Confirmed': { en: '€ Confirmed', nl: '€ Bevestigd' },
  'Offer Status': { en: 'Offer Status', nl: 'Offertestatus' },
  'Margin %': { en: 'Margin %', nl: 'Marge %' },
  'Cost ZZP': { en: 'Cost ZZP', nl: 'Kosten ZZP' },
  'Cost Internal': { en: 'Cost Internal', nl: 'Kosten Intern' },
  'Cost Mobility': { en: 'Cost Mobility', nl: 'Kosten Mobiliteit' },
  'Cost Acco.': { en: 'Cost Acco.', nl: 'Kosten Acco.' },
  'Cost Internet': { en: 'Cost Internet', nl: 'Kosten Internet' },
  'Cost PP': { en: 'Cost PP', nl: 'Kosten PP' },
  'Cost Other': { en: 'Cost Other', nl: 'Kosten Overig' },
  'Revenue Trans.': { en: 'Revenue Trans.', nl: 'Omzet Trans.' },
  'Revenue Total': { en: 'Revenue Total', nl: 'Omzet Totaal' },
  'Actual Margin €': { en: 'Actual Margin €', nl: 'Actuele Marge €' },
  'CSM': { en: 'CSM', nl: 'CSM' },
  'Account Manager': { en: 'Account Manager', nl: 'Account Manager' },
  'Clear Assignment': { en: 'Clear Assignment', nl: 'Wis Toewijzing' },

  // Event Cockpit
  'Event Cockpit': { en: 'Event Cockpit', nl: 'Evenement Cockpit' },

  // Event Details Section
  'Event Details': { en: 'Event Details', nl: 'Evenementdetails' },
  'Expected Visitors per Showdate': { en: 'Expected Visitors per Showdate', nl: 'Verwachte Bezoekers per Showdatum' },
  'Leave empty to auto-calculate from showdates': { en: 'Leave empty to auto-calculate from showdates', nl: 'Laat leeg voor automatische berekening uit showdatums' },
  'Expected Platform Costs': { en: 'Expected Platform Costs', nl: 'Verwachte Platformkosten' },
  'Expected Platform Cost': { en: 'Expected Platform Cost', nl: 'Verwachte Platformkosten' },

  // Realization Cost Corrections
  'Realization Corrections': { en: 'Realization Corrections', nl: 'Realisatie Correcties' },
  'Total Corrections': { en: 'Total Corrections', nl: 'Totale Correcties' },
  'Corrections': { en: 'Corrections', nl: 'Correcties' },
  'Rev': { en: 'Rev', nl: 'Omz' },
  'Pft': { en: 'Pft', nl: 'Wst' },

  'Realization': { en: 'Realization', nl: 'Realisatie' },
  'Add. Costs': { en: 'Add. Costs', nl: 'Aanv. Kosten' },

  'Year': { en: 'Jaar', nl: 'Jaar' },
  'Showing': { en: 'Showing', nl: 'Toont' },
  'of': { en: 'of', nl: 'van' },
  'offers': { en: 'offers', nl: 'offertes' },
  
  'Manage and track your festival projects': { en: 'Manage and track your festival projects', nl: 'Beheer en volg uw festivalprojecten' },
  'No projects found': { en: 'No projects found', nl: 'Geen projecten gevonden' },
  'Projects are automatically created when offers are confirmed': { en: 'Projects are automatically created when offers are confirmed', nl: 'Projecten worden automatisch aangemaakt wanneer offertes worden bevestigd' },
  'projects': { en: 'projects', nl: 'projecten' },
  'Margin': { en: 'Marge', nl: 'Marge' },

  'Expected Transactions': { en: 'Expected Transactions', nl: 'Verwachte Transacties' },
  'visitors': { en: 'visitors', nl: 'bezoekers' },
  'avg. festival transaction': { en: 'avg. festival transaction', nl: 'gem. festivaltransactie' },
  'date': { en: 'date', nl: 'datum' },
  'dates': { en: 'dates', nl: 'datums' },
  'Total (auto)': { en: 'Total (auto)', nl: 'Totaal (auto)' },
  'No showdates selected yet': { en: 'No showdates selected yet', nl: 'Nog geen showdates geselecteerd' },

  'Additional Costs': { en: 'Additional Costs', nl: 'Aanvullende Kosten' },
  'Total Additional Costs': { en: 'Total Additional Costs', nl: 'Totaal Aanvullende Kosten' },
  'Personeelskosten intern': { en: 'Internal Staff Costs', nl: 'Personeelskosten intern' },
  'Personeelskosten extern': { en: 'External Staff Costs', nl: 'Personeelskosten extern' },
  'Reiskosten': { en: 'Travel Costs', nl: 'Reiskosten' },
  'Mobiliteit': { en: 'Mobility', nl: 'Mobiliteit' },
  'Overnachtingen': { en: 'Accommodations', nl: 'Overnachtingen' },
  'Breuk/verkoop': { en: 'Breakage/Sales', nl: 'Breuk/verkoop' },
  'Internet/techniek': { en: 'Internet/Tech', nl: 'Internet/techniek' },
  'Overige kosten': { en: 'Other Costs', nl: 'Overige kosten' },

  // New translations for Projects Table
  'dagen': { en: 'days', nl: 'dagen' },
  'show': { en: 'show', nl: 'show' },
  'planning': { en: 'planning', nl: 'planning' },
  'preproduction': { en: 'preproduction', nl: 'preproductie' },
  'next_up': { en: 'next up', nl: 'volgende' },
  'active': { en: 'active', nl: 'actief' },
  'closing': { en: 'closing', nl: 'afsluiting' },
  'complete': { en: 'complete', nl: 'compleet' },

  'Client and Project Required': { en: 'Client and Project Required', nl: 'Klant en Project Vereist' },
  'Please select a client and enter a project name in the Event Cockpit above to start editing the offer.': { 
    en: 'Please select a client and enter a project name in the Event Cockpit above to start editing the offer.',
    nl: 'Selecteer een klant en voer een projectnaam in de Event Cockpit hierboven in om de offerte te bewerken.'
  },

  // Task Templates
  'Task Templates': { en: 'Task Templates', nl: 'Taken Sjablonen' },
  'Manage task templates for each service': { en: 'Manage task templates for each service', nl: 'Beheer taken sjablonen per dienst' },
  'Service': { en: 'Dienst', nl: 'Dienst' },
  'Subtasks': { en: 'Subtasks', nl: 'Subtaken' },
  'Add Task': { en: 'Add Task', nl: 'Taak Toevoegen' },
  'Add Subtask': { en: 'Add Subtask', nl: 'Subtaak Toevoegen' },
  'Task Name': { en: 'Task Name', nl: 'Taaknaam' },
  'Subtask Name': { en: 'Subtask Name', nl: 'Subtaaknaam' },
  'Delete Task': { en: 'Delete Task', nl: 'Taak Verwijderen' },
  'Delete Subtask': { en: 'Delete Subtask', nl: 'Subtaak Verwijderen' },
  'Save Template': { en: 'Save Template', nl: 'Sjabloon Opslaan' },
  'Template saved successfully': { en: 'Template saved successfully', nl: 'Sjabloon succesvol opgeslagen' },
  'Failed to save template': { en: 'Failed to save template', nl: 'Sjabloon opslaan mislukt' },

  // Service Items Column
  'Diensten': { en: 'Services', nl: 'Diensten' },
  'Ingepland': { en: 'Scheduled', nl: 'Ingepland' },
  'Service item updated': { en: 'Service item updated', nl: 'Dienst bijgewerkt' },
  'Failed to update service item': { en: 'Failed to update service item', nl: 'Dienst bijwerken mislukt' },

  // Add new translation
  'Schedule Services': { en: 'Schedule Services', nl: 'Plan Diensten' },

  // Add new translations for Transport Column
  'Vervoer': { en: 'Transport', nl: 'Vervoer' },
  'Select transport': { en: 'Select transport', nl: 'Selecteer vervoer' },
  'Transport method updated': { en: 'Transport method updated', nl: 'Vervoersmethode bijgewerkt' },
  'Failed to update transport method': { en: 'Failed to update transport method', nl: 'Vervoersmethode bijwerken mislukt' },

  // Add new translations for Evaluatie Tab with Rich Text Editor
  'Evaluatie': { en: 'Evaluation', nl: 'Evaluatie' },
  'Project Evaluatie': { en: 'Project Evaluation', nl: 'Project Evaluatie' },
  'Save Evaluation': { en: 'Save Evaluation', nl: 'Evaluatie Opslaan' },
  'Evaluation saved': { en: 'Evaluation saved', nl: 'Evaluatie opgeslagen' },
  'Failed to save evaluation': { en: 'Failed to save evaluation', nl: 'Evaluatie opslaan mislukt' },

  // Add new translations for Other Revenue
  'Overige omzet': { en: 'Other Revenue', nl: 'Overige omzet' },
  'Other revenue updated': { en: 'Other revenue updated', nl: 'Overige omzet bijgewerkt' },
  'Failed to update other revenue': { en: 'Failed to update other revenue', nl: 'Overige omzet bijwerken mislukt' },
};

const LocalizationContext = createContext();

export const LocalizationProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('appLanguage') || 'nl';
        }
        return 'nl';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedLang = localStorage.getItem('appLanguage');
            if (storedLang && storedLang !== language) {
                setLanguage(storedLang);
            }
        }
    }, [language]);

    const setAppLanguage = useCallback((lang) => {
        if (['en', 'nl'].includes(lang)) {
            setLanguage(lang);
            if (typeof window !== 'undefined') {
                localStorage.setItem('appLanguage', lang);
            }
        }
    }, []);

    const t = useCallback((key) => {
        return translations[key]?.[language] || key;
    }, [language]);

    const value = useMemo(() => ({
        language,
        setAppLanguage,
        t
    }), [language, setAppLanguage, t]);

    return (
        <LocalizationContext.Provider value={value}>
            {children}
        </LocalizationContext.Provider>
    );
};

export const useLocalization = () => {
    const context = useContext(LocalizationContext);
    if (!context) {
        throw new Error('useLocalization must be used within a LocalizationProvider');
    }
    return context;
};