import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Offer, Project, Product, Client, TeamMember, ProductCategorySetting } from '@/api/entities';
import { toast } from 'sonner';
import { Pen, RotateCcw, CheckCircle, X, Type } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { base44 } from '@/api/base44Client';

export default function SignaturePad({ offer, onOfferSigned, onCancel }) {
  const canvasRef = useRef(null);
  const typedCanvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [hasDrawnSignature, setHasDrawnSignature] = useState(false);
  const [useTypedSignature, setUseTypedSignature] = useState(false);

  // Load existing client data to pre-populate fields
  useEffect(() => {
    const loadClientData = async () => {
      if (offer?.client_id) {
        try {
          const client = await Client.get(offer.client_id);
          if (client) {
            if (client.company_name) {
              setCompanyName(client.company_name);
            }
            if (client.address) {
              setCompanyAddress(client.address);
            }
            if (client.contact_person) {
              setSignerName(client.contact_person);
            }
          }
        } catch (error) {
          console.error('Failed to load client data:', error);
        }
      }
    };
    
    loadClientData();
  }, [offer?.client_id]);

  // Generate typed signature whenever name changes
  useEffect(() => {
    if (signerName && signerName.trim()) {
      generateTypedSignature(signerName.trim());
    } else {
      // Clear typed signature if name is empty
      const canvas = typedCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [signerName]);

  const generateTypedSignature = (name) => {
    const canvas = typedCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Use a modern handwriting font - Caveat is available via Google Fonts
    ctx.font = '36px Caveat, cursive';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw the name centered in the canvas
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
  };

  const getCanvasCoordinates = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Get the actual client coordinates
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    // Calculate relative position and scale it to canvas coordinates
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    
    return { x, y };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const { x, y } = getCanvasCoordinates(e, canvas);

    setIsDrawing(true);
    setHasDrawnSignature(true);
    setUseTypedSignature(false); // User chose to draw
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const { x, y } = getCanvasCoordinates(e, canvas);

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearDrawnSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawnSignature(false);
  };

  const handleUseTypedSignature = () => {
    if (!signerName || !signerName.trim()) {
      toast.error('Vul eerst uw naam in om een getypte handtekening te gebruiken');
      return;
    }
    setUseTypedSignature(true);
    setHasDrawnSignature(false);
    clearDrawnSignature(); // Clear any drawn signature
  };

  // Check if all required fields are filled and signature is provided
  const isFormValid = () => {
    const hasName = signerName && signerName.trim().length > 0;
    const hasCompany = companyName && companyName.trim().length > 0;
    const hasAddress = companyAddress && companyAddress.trim().length > 0;
    
    // Check if user has either drawn a signature OR chosen to use typed signature
    const drawnCanvas = canvasRef.current;
    if (drawnCanvas) {
      const drawnCtx = drawnCanvas.getContext('2d');
      const drawnImageData = drawnCtx.getImageData(0, 0, drawnCanvas.width, drawnCanvas.height);
      const hasDrawn = drawnImageData.data.some(channel => channel !== 0);
      const hasSignature = hasDrawn || useTypedSignature;
      
      return hasName && hasCompany && hasAddress && hasSignature;
    }
    
    return false;
  };

  const calculateOfferProfit = (offerData, products, categorySettings) => {
    if (!offerData.offer_lines || !Array.isArray(offerData.offer_lines)) return 0;
    
    let standardProfit = 0;
    let postCalcProfit = 0;
    
    offerData.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings?.find(s => s.category === product.category);
      const isStandardSection = !setting || setting.calculation_type !== 'post_event';
      
      if (isStandardSection && line.quantity > 0) {
        const revenue = line.quantity * (line.unit_price || 0);
        const cost = line.quantity * (product.cost_basis || 0);
        standardProfit += (revenue - cost);
      }
    });
    
    offerData.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings?.find(s => s.category === product.category);
      const isPostCalcSection = setting?.calculation_type === 'post_event';
      
      if (isPostCalcSection) {
        const forecastQuantity = offerData.post_calc_forecasts?.[line.product_id] || 0;
        if (forecastQuantity > 0) {
          const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);
          const profit = forecastQuantity * (unitPrice - (product.cost_basis || 0));
          postCalcProfit += profit;
        }
      }
    });
    
    return standardProfit + postCalcProfit;
  };

  const handleSign = async () => {
    if (!signerName.trim()) {
      toast.error('Vul uw volledige naam in');
      return;
    }

    if (!companyName.trim()) {
      toast.error('Vul de bedrijfsnaam in');
      return;
    }

    if (!companyAddress.trim()) {
      toast.error('Vul het bedrijfsadres in');
      return;
    }

    // Check if user has either drawn a signature OR chosen to use typed signature
    const drawnCanvas = canvasRef.current;
    const drawnCtx = drawnCanvas.getContext('2d');
    const drawnImageData = drawnCtx.getImageData(0, 0, drawnCanvas.width, drawnCanvas.height);
    const hasDrawn = drawnImageData.data.some(channel => channel !== 0);

    if (!hasDrawn && !useTypedSignature) {
      toast.error('Teken uw handtekening of kies "Gebruik Getypte Handtekening"');
      return;
    }

    setIsSigning(true);

    try {
      // Get the signature data URL from either drawn or typed signature
      let signatureDataUrl;
      if (useTypedSignature) {
        const typedCanvas = typedCanvasRef.current;
        signatureDataUrl = typedCanvas.toDataURL();
      } else {
        signatureDataUrl = drawnCanvas.toDataURL();
      }
      
      // Update the offer with signature
      await Offer.update(offer.id, {
        signed_by_name: signerName.trim(),
        signed_date: new Date().toISOString(),
        signature_data_url: signatureDataUrl,
        status: 'confirmed'
      });

      // Update client information with company details
      if (offer.client_id) {
        const client = await Client.get(offer.client_id);
        await Client.update(offer.client_id, {
          company_name: companyName.trim(),
          address: companyAddress.trim(),
          contact_person: client.contact_person || signerName.trim()
        });
      }

      const products = await Product.list();
      const categorySettings = await ProductCategorySetting.list();

      const hardwareSummary = {};
      (offer.offer_lines || []).forEach(line => {
        const product = products.find(p => p.id === line.product_id);
        if (product && product.hardware_group && product.hardware_group !== 'none') {
          if (!hardwareSummary[product.hardware_group]) {
            hardwareSummary[product.hardware_group] = 0;
          }
          hardwareSummary[product.hardware_group] += line.quantity || 0;
        }
      });

      const estimatedProfit = calculateOfferProfit(offer, products, categorySettings);

      const setupDate = offer.showdates && offer.showdates.length > 0
        ? format(subDays(new Date(offer.showdates[0]), 1), 'yyyy-MM-dd')
        : null;

      // Calculate budget snapshot (sum of Quantity * cost_basis for all items)
      const budgetSnapshot = {};
      (offer.offer_lines || []).forEach(line => {
        const product = products.find(p => p.id === line.product_id);
        if (product && line.quantity > 0) {
          const productCost = line.quantity * (product.cost_basis || 0);
          budgetSnapshot[product.id] = productCost;
        }
      });

      // Load task templates to generate tasks with deadline dates
      const taskTemplates = await base44.entities.TaskTemplate.filter({ is_active: true });
      const projectTasks = [];
      const firstShowDate = offer.showdates && offer.showdates.length > 0 ? new Date(offer.showdates[0]) : null;

      taskTemplates.forEach(template => {
        (template.tasks || []).forEach(task => {
          const taskCopy = { ...task };
          
          // Calculate deadline date if firstShowDate exists
          if (firstShowDate && task.deadline_offset !== undefined && task.deadline_offset !== null) {
            const deadlineDate = new Date(firstShowDate);
            deadlineDate.setDate(deadlineDate.getDate() + task.deadline_offset);
            taskCopy.deadline_date = format(deadlineDate, 'yyyy-MM-dd');
          }
          
          taskCopy.service = template.service;
          projectTasks.push(taskCopy);
        });
      });

      await Project.create({
        offer_id: offer.id,
        client_id: offer.client_id,
        project_name: offer.project_name,
        project_location: offer.project_location,
        start_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[0] : offer.project_start_date,
        end_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[offer.showdates.length - 1] : offer.project_end_date,
        setup_date: setupDate,
        showdates: offer.showdates || [],
        expected_attendance: offer.expected_attendance,
        confirmed_revenue: offer.subtotal_excl_btw,
        estimated_profit: estimatedProfit,
        hardware_summary: hardwareSummary,
        budget_snapshot_json: budgetSnapshot,
        tasks: projectTasks,
        sales_handoff_notes: offer.sales_handoff_notes || '',
        services: ['Cashless', 'Ticketing', 'Festival App'],
        status: 'planning',
      });

      // Calculate financial breakdown
      const calculateBreakdown = () => {
        let standardRevenue = 0;
        let standardProfit = 0;
        let postEventRevenue = 0;
        let postEventProfit = 0;
        
        (offer.offer_lines || []).forEach(line => {
          const product = products.find(p => p.id === line.product_id);
          if (!product) return;
          
          const setting = categorySettings?.find(s => s.category === product.category);
          const isStandardSection = !setting || setting.calculation_type !== 'post_event';
          
          if (isStandardSection && line.quantity > 0) {
            const revenue = line.quantity * (line.unit_price || 0);
            const cost = line.quantity * (product.cost_basis || 0);
            standardRevenue += revenue;
            standardProfit += (revenue - cost);
          } else if (setting?.calculation_type === 'post_event') {
            const forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
            if (forecastQuantity > 0) {
              const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);
              const revenue = forecastQuantity * unitPrice;
              const cost = forecastQuantity * (product.cost_basis || 0);
              postEventRevenue += revenue;
              postEventProfit += (revenue - cost);
            }
          }
        });
        
        return {
          standardRevenue,
          standardProfit,
          postEventRevenue,
          postEventProfit,
          totalRevenue: standardRevenue + postEventRevenue,
          totalProfit: standardProfit + postEventProfit
        };
      };

      const breakdown = calculateBreakdown();
      
      const showdatesText = offer.showdates && offer.showdates.length > 0
        ? offer.showdates.map(d => format(new Date(d), 'dd-MM-yyyy')).join(', ')
        : 'Nog niet bepaald';

      const offerReviewUrl = `${window.location.origin}/OfferReview?id=${offer.id}`;

      // Send email notifications
      try {
        const teamMembers = await base44.entities.TeamMember.filter({
          is_active: true,
          receive_offer_notifications: true
        });
        
        const emailPromises = teamMembers.map(async (member) => {
          const emailSubject = `🎯 ${offer.project_name} heeft getekend!`;
          const emailBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Offerte Ondertekend! 🎉</h2>
              <p style="font-size: 16px; color: #374151;">Goed nieuws! Een nieuwe offerte is zojuist ondertekend door de klant.</p>
              
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1f2937; margin-top: 0;">Projectdetails:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Project:</td>
                    <td style="padding: 8px 0; color: #111827;">${offer.project_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Klant:</td>
                    <td style="padding: 8px 0; color: #111827;">${companyName.trim()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Locatie:</td>
                    <td style="padding: 8px 0; color: #111827;">${offer.project_location || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Showdates:</td>
                    <td style="padding: 8px 0; color: #111827;">${showdatesText}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ondertekend door:</td>
                    <td style="padding: 8px 0; color: #111827;">${signerName.trim()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Totaalbedrag:</td>
                    <td style="padding: 8px 0; color: #111827; font-size: 18px; font-weight: bold;">€${(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (incl. BTW)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Offerte #:</td>
                    <td style="padding: 8px 0; color: #111827;">${offer.offer_number}</td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #2563eb;">
                <h3 style="color: #1e40af; margin-top: 0;">Financiële Breakdown:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Standaard:</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #2563eb; font-weight: 600;">€${breakdown.standardRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span style="color: #10b981; font-weight: 600; margin-left: 16px;">€${breakdown.standardProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Post-Event:</td>
                    <td style="padding: 8px 0; text-align: right;">
                      <span style="color: #2563eb; font-weight: 600;">€${breakdown.postEventRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span style="color: #10b981; font-weight: 600; margin-left: 16px;">€${breakdown.postEventProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                  <tr style="border-top: 2px solid #2563eb;">
                    <td style="padding: 12px 0 0 0; color: #1e40af; font-weight: bold; font-size: 16px;">Totaal:</td>
                    <td style="padding: 12px 0 0 0; text-align: right;">
                      <span style="color: #2563eb; font-weight: 700; font-size: 16px;">€${breakdown.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span style="color: #10b981; font-weight: 700; font-size: 16px; margin-left: 16px;">€${breakdown.totalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding: 8px 0 0 0; text-align: right;">
                      <span style="font-size: 11px; color: #6b7280;">Omz</span>
                      <span style="font-size: 11px; color: #6b7280; margin-left: 56px;">Wst</span>
                    </td>
                  </tr>
                </table>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${offerReviewUrl}" style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2);">
                  📄 Bekijk Offerte
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                Het project is automatisch aangemaakt en kan nu worden ingepland in het systeem.
              </p>
              
              <p style="font-size: 14px; color: #6b7280;">
                Log in op het <strong>Fastlane platform</strong> om meer details te bekijken en het project te beheren.
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
                <p>Deze email is automatisch verzonden door het Fastlane platform.</p>
                <p style="margin-top: 8px;">
                  <a href="${offerReviewUrl}" style="color: #2563eb; text-decoration: none;">Direct link naar offerte →</a>
                </p>
              </div>
            </div>
          `;

          try {
            await base44.integrations.Core.SendEmail({
              from_name: 'Fastlane Events',
              to: member.email,
              subject: emailSubject,
              body: emailBody
            });
          } catch (emailError) {
            console.error(`Failed to send email to ${member.email}:`, emailError);
          }
        });

        await Promise.all(emailPromises);
      } catch (emailError) {
        console.error('Error sending email notifications:', emailError);
      }

      // Send Slack notification
      try {
        const slackPayload = {
          offerData: {
            project_name: offer.project_name,
            project_location: offer.project_location,
            offer_number: offer.offer_number,
            total_incl_btw: offer.total_incl_btw
          },
          breakdown,
          companyName: companyName.trim(),
          signerName: signerName.trim(),
          showdatesText,
          offerReviewUrl
        };

        await base44.functions.invoke('sendSlackNotification', slackPayload);
      } catch (slackError) {
        console.error('Error sending Slack notification:', slackError);
      }

      toast.success('Offerte succesvol ondertekend en project aangemaakt!');
      onOfferSigned();
    } catch (error) {
      console.error('Error signing offer:', error);
      toast.error('Fout bij ondertekenen. Probeer opnieuw.');
    } finally {
      setIsSigning(false);
    }
  };

  const formValid = isFormValid();

  return (
    <div className="p-4 sm:p-6">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
      `}</style>
      
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Pen className="w-6 h-6 text-green-600" />
          Onderteken Offerte
        </h2>
        {onCancel && (
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Contact Information */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="signerName" className="text-sm font-medium">Volledige naam *</Label>
              <Input
                id="signerName"
                type="text"
                placeholder="Voer uw volledige naam in"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={isSigning}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="companyName" className="text-sm font-medium">Bedrijfsnaam *</Label>
              <Input
                id="companyName"
                type="text"
                placeholder="Voer bedrijfsnaam in"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isSigning}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="companyAddress" className="text-sm font-medium">Adres *</Label>
            <Input
              id="companyAddress"
              type="text"
              placeholder="Voer volledig bedrijfsadres in"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              disabled={isSigning}
              className="w-full"
            />
          </div>
        </div>

        {/* Signature Options */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Kies uw handtekening methode:</h3>
          
          {/* Typed Signature Option - Compact */}
          <div className="border-2 border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4 text-blue-600" />
                <Label className="text-sm font-medium">Getypte Handtekening</Label>
              </div>
              <Button
                type="button"
                variant={useTypedSignature ? "default" : "outline"}
                size="sm"
                onClick={handleUseTypedSignature}
                disabled={isSigning || !signerName.trim()}
                className="h-8 text-xs"
              >
                {useTypedSignature ? "✓ Geselecteerd" : "Gebruik Dit"}
              </Button>
            </div>
            
            {signerName.trim() ? (
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-2 flex items-center justify-center" style={{ minHeight: '70px' }}>
                <canvas
                  ref={typedCanvasRef}
                  width={560}
                  height={70}
                  className="max-w-full h-auto"
                  style={{ fontFamily: 'Caveat, cursive' }}
                />
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-2 flex items-center justify-center" style={{ minHeight: '70px' }}>
                <p className="text-xs text-gray-500 italic">Vul uw naam in om een preview te zien</p>
              </div>
            )}
          </div>

          {/* OR Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="text-xs font-medium text-gray-500 uppercase">Of</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Drawn Signature Option */}
          <div className="border-2 border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pen className="w-4 h-4 text-purple-600" />
                <Label className="text-sm font-medium">Teken Handtekening</Label>
              </div>
              {hasDrawnSignature && !useTypedSignature && (
                <span className="text-xs text-green-600 font-medium">✓ Getekend</span>
              )}
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
              <canvas
                ref={canvasRef}
                width={560}
                height={140}
                className="cursor-crosshair w-full touch-none"
                style={{ touchAction: 'none' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearDrawnSignature}
              disabled={isSigning}
              className="w-full sm:w-auto h-8 text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-2" />
              Wis Getekende Handtekening
            </Button>
          </div>
        </div>

        {/* Terms and Conditions - Compact */}
        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-900 mb-1.5 text-xs">Door te ondertekenen:</h4>
          <ul className="text-xs text-green-800 space-y-0.5">
            <li>• Accepteert u alle voorwaarden</li>
            <li>• Bevestigt u dat de projectgegevens kloppen</li>
            <li>• Geeft u toestemming om te starten</li>
            <li>• Wordt dit een juridisch bindende overeenkomst</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {onCancel && (
            <Button 
              type="button"
              onClick={onCancel}
              variant="outline"
              className="w-full sm:flex-1"
              disabled={isSigning}
            >
              Annuleren
            </Button>
          )}
          
          <Button 
            type="button"
            onClick={handleSign}
            disabled={!formValid || isSigning}
            className={`w-full sm:flex-1 ${formValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-300 cursor-not-allowed'}`}
            size="lg"
          >
            {isSigning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Ondertekenen...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Onderteken & Accepteer
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}