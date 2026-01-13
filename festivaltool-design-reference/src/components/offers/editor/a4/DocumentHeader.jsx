import React from 'react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useLocalization } from '../../../Localization';

export default function DocumentHeader({ offer, clients = [], isReview = false }) {
    const { t } = useLocalization();
    const client = clients?.find(c => c.id === offer?.client_id);
    
    const selectedDates = offer?.showdates ? offer.showdates.map(date => new Date(date)) : [];

    return (
        <header style={{ pageBreakAfter: 'avoid', pageBreakInside: 'avoid' }}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b82e06e82c328f0770844d/ac2112737_Bluenewlogologoonly.png" alt="Fastlane Logo" className="w-10 h-10" />
                    <div>
                        <h2 className="font-bold text-gray-900 text-lg">Fastlane</h2>
                        <p className="text-xs text-gray-500">{t('Management Platform')}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="text-3xl font-bold uppercase text-gray-800">{t('Offerte')}</h1>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm mb-3">
                <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="font-semibold text-gray-600">{t('Opdrachtgever:')}</span>
                    <span className="text-sm">{client?.company_name || t('N/A')}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="font-semibold text-gray-600">{t('Offer #:')}</span>
                    <span className="text-sm">{offer?.offer_number || t('N/A')}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="font-semibold text-gray-600">{t('Version:')}</span>
                    <span className="text-sm">v{offer?.version ? offer.version.toFixed(1) : '1.0'}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="font-semibold text-gray-600">{t('Project:')}</span>
                    <span className="text-sm">{offer?.project_name || t('N/A')}</span>
                </div>
                <div className="grid grid-cols-[110px_1fr] items-center gap-2">
                    <span className="font-semibold text-gray-600">{t('Location:')}</span>
                    <span className="text-sm">{offer?.project_location || t('N/A')}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="font-semibold text-gray-600">{isReview ? 'Showdata:' : t('Showdates:')}</span>
                    <span className="text-sm">
                        {selectedDates.length > 0 
                            ? selectedDates.map(date => format(date, 'dd-MM-yyyy')).join(', ')
                            : t('N/A')
                        }
                    </span>
                </div>
            </div>
        </header>
    );
}