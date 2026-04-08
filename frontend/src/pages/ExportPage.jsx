/**
 * Phase 3 - Export Page
 * Full-page interface for advanced reporting and exports
 */

import React from 'react';
import DashboardLayout from '../components/Layout/DashboardLayout';
import ExportManager from '../components/export/ExportManager';
import { useOrganization } from '../contexts/OrganizationContext';

const ExportPage = () => {
  const { currentOrganization, userRole } = useOrganization();

  return (
    <DashboardLayout>
      <div className="export-page">
        <ExportManager 
          organizationId={currentOrganization?._id}
          userRole={userRole}
        />
      </div>
    </DashboardLayout>
  );
};

export default ExportPage;
