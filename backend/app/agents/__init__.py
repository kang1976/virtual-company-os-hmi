# backend/app/agents/__init__.py
from backend.app.agents.base import BaseAgent
from backend.app.agents.coo import COOAgent, TaskDecomposition, COODecompositionSchema, COOApprovalSchema
from backend.app.agents.patent.search import PatentSearchAgent, PatentOutputSchema
from backend.app.agents.dev.backend import BackendDevAgent, DevOutputSchema
from backend.app.agents.dev.frontend import FrontendDevAgent, FrontendOutputSchema
from backend.app.agents.security import SecurityAgent, SecurityOutputSchema, SecOpsAuditAgent, SecOpsAuditOutputSchema
from backend.app.agents.qa import QAAgent, QAOutputSchema, SeniorQAAgent, SeniorQAOutputSchema
from backend.app.agents.marketing import (
    ProductMarketingAgent,
    CatalogOutputSchema,
    ManualOutputSchema,
    CommercialPackageSchema,
)
from backend.app.agents.design import ChiefDesignAgent, DesignSpecSchema
from backend.app.agents.engineering_agents import (
    SoftwareArchitectAgent,
    ArchitectureSpecSchema,
    MobileAppBuilderAgent,
    MobileSpecSchema,
    EmbeddedFirmwareAgent,
    EmbeddedSpecSchema,
    DatabaseOptimizerAgent,
    DBOptimizerSchema,
    DevOpsAutomatorAgent,
    DevOpsSpecSchema,
    CodeReviewerAgent,
    CodeReviewSchema,
    MinimalChangeAgent,
    MinimalPatchSchema,
)
from backend.app.agents.design_specialists import (
    UIFinishGateAgent,
    FinishGateAuditSchema,
    UXArchitectAgent,
    UXArchitectureSchema,
)

__all__ = [
    "BaseAgent",
    "COOAgent",
    "TaskDecomposition",
    "COODecompositionSchema",
    "COOApprovalSchema",
    "PatentSearchAgent",
    "PatentOutputSchema",
    "BackendDevAgent",
    "DevOutputSchema",
    "FrontendDevAgent",
    "FrontendOutputSchema",
    "SecurityAgent",
    "SecurityOutputSchema",
    "SecOpsAuditAgent",
    "SecOpsAuditOutputSchema",
    "QAAgent",
    "QAOutputSchema",
    "SeniorQAAgent",
    "SeniorQAOutputSchema",
    "ProductMarketingAgent",
    "CatalogOutputSchema",
    "ManualOutputSchema",
    "CommercialPackageSchema",
    "ChiefDesignAgent",
    "DesignSpecSchema",
    "SoftwareArchitectAgent",
    "ArchitectureSpecSchema",
    "MobileAppBuilderAgent",
    "MobileSpecSchema",
    "EmbeddedFirmwareAgent",
    "EmbeddedSpecSchema",
    "DatabaseOptimizerAgent",
    "DBOptimizerSchema",
    "DevOpsAutomatorAgent",
    "DevOpsSpecSchema",
    "CodeReviewerAgent",
    "CodeReviewSchema",
    "MinimalChangeAgent",
    "MinimalPatchSchema",
    "UIFinishGateAgent",
    "FinishGateAuditSchema",
    "UXArchitectAgent",
    "UXArchitectureSchema",
]


